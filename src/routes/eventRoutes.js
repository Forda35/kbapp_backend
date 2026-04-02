const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const auth = require("../middleware/auth");

const prisma = new PrismaClient();

// GET tous les événements (public)
router.get("/", async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const events = await prisma.event.findMany({
      where: { date: { gte: todayStart } },
      include: { tickets: { select: { id: true } } },
      orderBy: { date: "asc" },
    });

    const result = events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date,
      price: event.price,
      location: event.location,
      imageUrl: event.imageUrl,
      ticketsSold: event.tickets.length,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET un événement spécifique (public)
router.get("/:id", async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: { tickets: { select: { id: true } } },
    });

    if (!event) return res.status(404).json({ message: "Événement non trouvé" });

    res.json({
      ...event,
      ticketsSold: event.tickets.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// POST créer un événement (admin seulement)
router.post("/create", auth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Accès refusé – Réservé à l'administrateur" });
  }

  const { title, description, date, price, location, imageUrl } = req.body;

  if (!title || !description || !date || !price) {
    return res.status(400).json({ message: "Titre, description, date et prix sont obligatoires" });
  }

  try {
    const event = await prisma.event.create({
      data: {
        title,
        description,
        date: new Date(date),
        price: parseFloat(price),
        location: location || "",
        imageUrl: imageUrl || null,
      },
    });

    res.json({ message: "Événement créé avec succès", event });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// DELETE supprimer un événement (admin seulement)
router.delete("/:id", auth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Accès refusé – Réservé à l'administrateur" });
  }

  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ message: "Événement supprimé" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET stats du dashboard (admin seulement)
router.get("/admin/stats", auth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Accès refusé – Réservé à l'administrateur" });
  }

  try {
    const [events, totalUsers, totalTickets, totalRevenue] = await Promise.all([
      prisma.event.findMany({
        include: {
          tickets: {
            where: { status: "confirmed" }, // seulement confirmés
            select: { id: true, used: true, purchasedAt: true },
          },
          payments: {
            where: { status: "completed" }, // seulement complétés
            select: { id: true, amount: true, status: true, method: true },
          },
        },
        orderBy: { date: "desc" },
      }),
      prisma.user.count({ where: { verified: true } }),
      prisma.ticket.count({ where: { status: "confirmed" } }), // seulement confirmés
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: "completed" },
      }),
    ]);

    const eventStats = events.map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      price: event.price,
      location: event.location,
      sold: event.tickets.length,
      usedTickets: event.tickets.filter((t) => t.used).length,
      revenue: event.tickets.length * event.price,
      payments: event.payments,
    }));

    // Ventes par mois (seulement billets confirmés)
    const monthlySales = {};
    events.forEach((event) => {
      event.tickets.forEach((ticket) => {
        const month = new Date(ticket.purchasedAt).toLocaleDateString("fr-FR", {
          month: "short",
          year: "numeric",
        });
        monthlySales[month] = (monthlySales[month] || 0) + 1;
      });
    });

    res.json({
      summary: {
        totalEvents: events.length,
        totalUsers,
        totalTickets,
        totalRevenue: totalRevenue._sum.amount || 0,
      },
      events: eventStats,
      monthlySales: Object.entries(monthlySales).map(([month, count]) => ({
        month,
        count,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
