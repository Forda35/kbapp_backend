const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { PrismaClient } = require("@prisma/client");
const { v4: uuidv4 } = require("uuid");

const prisma = new PrismaClient();

// POST acheter un ticket
router.post("/buy", auth, async (req, res) => {
  const { eventId } = req.body;
  const userId = req.user.id;

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ message: "Événement non trouvé" });
    }

    // Vérifier si événement passé
    const eventEnd = new Date(event.date);
    eventEnd.setHours(23, 59, 59, 999);

    if (new Date() > eventEnd) {
      return res.status(400).json({
        message: "Impossible d'acheter un billet pour un événement passé",
      });
    }

    // Vérifier si billet confirmé existant
const existingTicket = await prisma.ticket.findFirst({
  where: { userId, eventId, status: "confirmed" },
});

if (existingTicket) {
  return res.status(400).json({
    message: "Vous possédez déjà un billet confirmé pour cet événement",
    ticket: existingTicket,
  });
}

// Nettoyer les billets pending/cancelled
await prisma.ticket.deleteMany({
  where: { userId, eventId, status: { in: ["pending", "cancelled"] } },
});

    // Générer QR code unique
    const qrCode = uuidv4();

    // Créer le ticket
    const ticket = await prisma.ticket.create({
      data: { userId, eventId, qrCode },
      include: { event: true },
    });

    res.json({
      message: "Billet acheté avec succès !",
      ticket,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Récupérer uniquement les billets confirmés
router.get("/", auth, async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        userId: req.user.id,
        status: "confirmed", // seulement les billets confirmés
      },
      include: { event: true },
      orderBy: { purchasedAt: "desc" },
    });
    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// POST scanner un ticket (admin/agent uniquement – pas exposé au frontend utilisateur)
router.post("/scan", auth, async (req, res) => {
  if (req.user.role !== "admin" && req.user.role !== "agent") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  let { qrCode, scannerId } = req.body;

  if (!qrCode) {
    return res.status(400).json({ message: "QR code manquant" });
  }

  qrCode = qrCode.trim();
  if (qrCode.includes("/")) qrCode = qrCode.split("/").pop();
  if (qrCode.length > 36) qrCode = qrCode.slice(0, 36);

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { qrCode },
      include: { event: true, user: true },
    });

    if (!ticket) {
      return res.status(404).json({ message: "Billet invalide – QR code inconnu" });
    }

    if (ticket.used) {
      return res.status(400).json({
        message: "Ce billet a déjà été utilisé",
        scannedBy: ticket.scannedBy,
      });
    }

    const updatedTicket = await prisma.ticket.update({
      where: { qrCode },
      data: {
        used: true,
        scannedBy: scannerId || req.user.email || "SCANNER_INCONNU",
      },
    });

    res.json({
      message: "Billet validé avec succès",
      ticket: {
        id: updatedTicket.id,
        user: ticket.user.email,
        event: ticket.event.title,
        date: ticket.event.date,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
