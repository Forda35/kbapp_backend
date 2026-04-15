const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { PrismaClient } = require("@prisma/client");
const { v4: uuidv4 } = require("uuid");
const { generateMotif, getMotifExpiry } = require("../utils/motifGenerator");
const { parseSMS } = require("../utils/smsParser");

const prisma = new PrismaClient();

// ── Confirmation manuelle Orange Money via ID de transaction ─────────────
router.post("/confirm-orange", auth, async (req, res) => {
  const { paymentId, transactionId } = req.body;
  const userId = req.user.id;

  if (!paymentId || !transactionId) {
    return res.status(400).json({ message: "paymentId et transactionId sont requis" });
  }

  const trimmedId = transactionId.trim();
  if (trimmedId.length < 4) {
    return res.status(400).json({ message: "ID de transaction invalide" });
  }

  try {
    // Récupérer le paiement
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { event: true },
    });

    if (!payment) return res.status(404).json({ message: "Paiement non trouvé" });
    if (payment.userId !== userId) return res.status(403).json({ message: "Accès refusé" });
    if (payment.method !== "Orange Money") return res.status(400).json({ message: "Cette route est réservée aux paiements Orange Money" });
    if (payment.status !== "pending") return res.status(400).json({ message: "Ce paiement n'est plus en attente" });

    // Vérifier expiration
    if (new Date() > new Date(payment.motifExpiry)) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "expired" } });
      if (payment.ticketId) {
        await prisma.ticket.update({ where: { id: payment.ticketId }, data: { status: "cancelled" } });
      }
      return res.status(400).json({ message: "Ce paiement a expiré" });
    }

    // Vérifier que le backend a bien reçu ce Trans Id via SMS Forwarder
    // orangeTransactionId est stocké par le webhook lors de la réception du SMS Orange
    if (!payment.orangeTransactionId) {
      return res.status(400).json({
        message: "Aucun paiement Orange Money reçu pour ce dossier. Patientez que le SMS soit détecté, ou vérifiez votre ID de transaction.",
      });
    }

    if (payment.orangeTransactionId.toUpperCase() !== trimmedId.toUpperCase()) {
      return res.status(400).json({
        message: "L'ID de transaction ne correspond pas au paiement reçu. Vérifiez votre SMS Orange Money.",
      });
    }

    // ✅ L'ID correspond à ce qu'a reçu le backend — paiement vérifié
    const qrCode = uuidv4();

    await prisma.ticket.update({
      where: { id: payment.ticketId },
      data: { status: "confirmed", qrCode },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "completed" },
    });

    const ticket = await prisma.ticket.findUnique({
      where: { id: payment.ticketId },
      include: { event: true },
    });

    console.log(`✅ Orange Money confirmé manuellement: paymentId=${payment.id}, transactionId=${trimmedId}`);

    res.json({
      message: "Paiement Orange Money confirmé",
      paymentId: payment.id,
      ticketId: payment.ticketId,
      ticket,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Codes marchands / numéros selon la méthode
const PAYMENT_DESTINATIONS = {
  "Airtel Money": process.env.AIRTEL_MONEY_MERCHANT_CODE || "AIRTEL123",
  "Orange Money": process.env.ORANGE_MONEY_PHONE || "032 00 000 00",
};

// ── Initier un paiement ──────────────────────────────────────
router.post("/initiate", auth, async (req, res) => {
  const { eventId, phone, method } = req.body;
  const userId = req.user.id;

  const validMethods = ["Orange Money", "Airtel Money"];
  if (!validMethods.includes(method)) {
    return res.status(400).json({ message: "Méthode de paiement invalide" });
  }

  if (!eventId || !phone || !method) {
    return res.status(400).json({ message: "Événement, téléphone et méthode requis" });
  }

  try {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ message: "Événement non trouvé" });

    // Vérifier si déjà un paiement complété
    const existingConfirmed = await prisma.ticket.findFirst({
      where: { userId, eventId, status: "confirmed" },
    });
    if (existingConfirmed) {
      return res.status(400).json({ message: "Vous avez déjà un billet confirmé pour cet événement" });
    }

    // Vérifier si paiement en cours valide
    const existingPayment = await prisma.payment.findFirst({
      where: {
        userId,
        eventId,
        status: "pending",
        motifExpiry: { gt: new Date() },
      },
    });
    if (existingPayment) {
      return res.status(400).json({ message: "Vous avez déjà un paiement en cours pour cet événement" });
    }

    // Générer motif unique
    const motif = generateMotif();
    const motifExpiry = getMotifExpiry();

    // Destination paiement : code marchand pour Airtel, numéro de téléphone pour Orange
    const merchantCode = PAYMENT_DESTINATIONS[method];

    // Supprimer billets pending/cancelled existants
    await prisma.ticket.deleteMany({
      where: { userId, eventId, status: { in: ["pending", "cancelled"] } },
    });

    // Créer billet en attente
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
        // Pour Orange Money: pas de motif a saisir, confirmation via ID de transaction
        motif: method === "Orange Money" ? null : motif,
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

// ── Vérifier le statut d'un paiement (polling frontend toutes les 5s) ─────
router.get("/status/:paymentId", auth, async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.paymentId },
      include: { ticket: { include: { event: true } } },
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

// ── SMS Webhook — reçoit le SMS parsé depuis SMS Forwarder ─────────────
router.post("/sms-webhook", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.SMS_WEBHOOK_SECRET) {
    return res.status(401).json({ message: "Non autorisé" });
  }

  const { smsBody, sender } = req.body;
  console.log("SMS reçu de", sender, ":", smsBody);

  const parsed = parseSMS(smsBody);
  if (!parsed) {
    return res.status(400).json({ message: "SMS non reconnu" });
  }

  const { method, amount, motif, transactionId } = parsed;
  console.log("SMS parsé — méthode:", method, "montant:", amount,
    method === "Orange Money" ? "transactionId:" : "motif:", transactionId || motif);

  try {
    // ── Orange Money : enregistrer l'ID de transaction, attendre confirmation utilisateur ──
    if (method === "Orange Money") {
      // Vérifier que cet ID n'est pas déjà enregistré
      const duplicate = await prisma.payment.findFirst({
        where: { orangeTransactionId: { equals: transactionId, mode: "insensitive" } },
      });
      if (duplicate) {
        return res.status(400).json({ message: "ID de transaction déjà enregistré" });
      }

      // Trouver le paiement Orange Money pending dont le montant correspond
      const payment = await prisma.payment.findFirst({
        where: {
          method: "Orange Money",
          status: "pending",
          motifExpiry: { gt: new Date() },
          amount: { gte: amount - 1, lte: amount + 1 },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!payment) {
        console.log(`⚠️ Aucun paiement Orange Money pending trouvé pour montant=${amount}`);
        return res.status(404).json({ message: "Aucun paiement en attente correspondant" });
      }

      // Stocker l'ID de transaction — le paiement reste pending
      // L'utilisateur doit encore le confirmer dans l'app
      await prisma.payment.update({
        where: { id: payment.id },
        data: { orangeTransactionId: transactionId },
      });

      console.log(`📲 ID de transaction Orange enregistré: ${transactionId} → paiement ${payment.id}`);
      return res.json({
        message: "ID de transaction Orange Money enregistré, en attente de confirmation utilisateur",
        paymentId: payment.id,
      });
    }

    // ── Airtel Money : confirmation automatique via motif KB-XXXX ──
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

    // Vérifier le montant (tolérance 1 Ar)
    if (amount && Math.abs(amount - payment.amount) > 1) {
      return res.status(400).json({
        message: `Montant incorrect. Attendu: ${payment.amount} Ar, Reçu: ${amount} Ar`,
      });
    }

    // Générer QR et confirmer le billet
    const qrCode = uuidv4();

    await prisma.ticket.update({
      where: { id: payment.ticketId },
      data: { status: "confirmed", qrCode },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "completed" },
    });

    console.log(`✅ Paiement Airtel confirmé automatiquement: ${payment.id}, Motif: ${motif}`);

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

// ── Vérifier si paiement en attente existe pour un événement ────────────
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