const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { PrismaClient } = require("@prisma/client");
const { v4: uuidv4 } = require("uuid");
const { generateMotif, getMotifExpiry } = require("../utils/motifGenerator");
const { parseSMS } = require("../utils/smsParser");

const prisma = new PrismaClient();

const MERCHANT_CODES = {
  MVola: process.env.MVOLA_MERCHANT_CODE || "MVOLA123",
  "Orange Money": process.env.ORANGE_MONEY_MERCHANT_CODE || "ORANGE456",
  "Airtel Money": process.env.AIRTEL_MONEY_MERCHANT_CODE || "AIRTEL789",
};

// ── Initier un paiement ──────────────────────────────────────
router.post("/initiate", auth, async (req, res) => {
  const { eventId, phone, method } = req.body;
  const userId = req.user.id;

  if (!eventId || !phone || !method) {
    return res.status(400).json({ message: "Événement, téléphone et méthode requis" });
  }

  try {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ message: "Événement non trouvé" });

    // Vérifier si déjà un paiement en cours valide
    const existingPayment = await prisma.payment.findFirst({
      where: {
        userId,
        eventId,
        status: { in: ["pending", "completed"] },
        motifExpiry: { gt: new Date() },
      },
    });

    if (existingPayment?.status === "completed") {
      return res.status(400).json({ message: "Vous avez déjà acheté ce billet" });
    }

    // Générer motif unique
    const motif = generateMotif();
    const motifExpiry = getMotifExpiry();
    const merchantCode = MERCHANT_CODES[method];

   // Vérifier s'il existe déjà un billet confirmé
const existingConfirmed = await prisma.ticket.findFirst({
  where: { userId, eventId, status: "confirmed" },
});

if (existingConfirmed) {
  return res.status(400).json({ message: "Vous avez déjà un billet confirmé pour cet événement" });
}

// Supprimer tout billet pending/cancelled existant pour cet user+event
await prisma.ticket.deleteMany({
  where: {
    userId,
    eventId,
    status: { in: ["pending", "cancelled"] },
  },
});

// Créer le nouveau billet en attente
const ticket = await prisma.ticket.create({
  data: { userId, eventId, status: "pending" },
  include: { event: true },
});

    // Créer paiement
    const payment = await prisma.payment.create({
      data: {
        amount: event.price,
        status: "pending",
        method,
        phone,
        merchantCode,
        motif,
        motifExpiry,
        userId,
        eventId,
        ticketId: ticket.id,
      },
    });

    // Expiration automatique après 30 min
    setTimeout(async () => {
      try {
        const p = await prisma.payment.findUnique({ where: { id: payment.id } });
        if (p && p.status === "pending") {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: "expired" },
          });
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: "cancelled" },
          });
          console.log(`Paiement expiré : ${payment.id}`);
        }
      } catch (e) { console.error("Expiry error:", e); }
    }, 30 * 60 * 1000);

    res.json({
      message: "Paiement initié",
      payment: {
        id: payment.id,
        amount: event.price,
        currency: "Ar",
        method,
        merchantCode,
        motif,
        motifExpiry,
        phone,
        ticketId: ticket.id,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Vérifier le statut d'un paiement (polling frontend) ─────
router.get("/status/:paymentId", auth, async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.paymentId },
      include: {
        ticket: { include: { event: true } },
      },
    });

    if (!payment) return res.status(404).json({ message: "Paiement non trouvé" });
    if (payment.userId !== req.user.id) return res.status(403).json({ message: "Accès refusé" });

    // Vérifier expiration
    const isExpired = new Date() > new Date(payment.motifExpiry) && payment.status === "pending";
    if (isExpired) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "expired" } });
      if (payment.ticketId) {
        await prisma.ticket.update({ where: { id: payment.ticketId }, data: { status: "cancelled" } });
      }
      return res.json({ status: "expired", payment });
    }

    res.json({
      status: payment.status,
      payment,
      ticket: payment.ticket,
      timeLeft: Math.max(0, Math.floor((new Date(payment.motifExpiry) - new Date()) / 1000)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Recevoir le SMS parsé (depuis l'app Android) ─────────────
router.post("/sms-webhook", async (req, res) => {
  // Sécurité basique avec clé API
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.SMS_WEBHOOK_SECRET) {
    return res.status(401).json({ message: "Non autorisé" });
  }

  const { smsBody, sender } = req.body;
  console.log("SMS reçu:", smsBody);

  const parsed = parseSMS(smsBody);
  if (!parsed) {
    return res.status(400).json({ message: "SMS non reconnu" });
  }

  const { motif, amount, method } = parsed;

  try {
    // Trouver le paiement avec ce motif
    const payment = await prisma.payment.findFirst({
      where: {
        motif: { equals: motif, mode: "insensitive" },
        status: "pending",
        motifExpiry: { gt: new Date() },
      },
      include: { event: true },
    });

    if (!payment) {
      return res.status(404).json({ message: "Motif invalide ou expiré" });
    }

    // Vérifier le montant (tolérance de 1 Ar)
    if (amount && Math.abs(amount - payment.amount) > 1) {
      return res.status(400).json({
        message: `Montant incorrect. Attendu: ${payment.amount} Ar, Reçu: ${amount} Ar`,
      });
    }

    // Générer le QR code et confirmer le billet
    const qrCode = uuidv4();

    await prisma.ticket.update({
      where: { id: payment.ticketId },
      data: { status: "confirmed", qrCode },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "completed" },
    });

    console.log(`Paiement confirmé: ${payment.id}, Motif: ${motif}`);

    res.json({
      message: "Paiement confirmé",
      paymentId: payment.id,
      ticketId: payment.ticketId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Codes marchands (pour affichage) ────────────────────────
router.get("/merchant-codes", auth, (req, res) => {
  res.json({ merchantCodes: MERCHANT_CODES });
});

// Vérifier si un paiement en attente existe pour un événement
router.get("/pending/:eventId", auth, async (req, res) => {
  try {
    const payment = await prisma.payment.findFirst({
      where: {
        userId: req.user.id,
        eventId: req.params.eventId,
        status: "pending",
        motifExpiry: { gt: new Date() },
      },
    });
    res.json({ hasPending: !!payment, payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
module.exports = router;