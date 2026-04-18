/**
 * Parse un SMS de confirmation de paiement Mobile Money
 * Détecte : Orange Money
 * Extrait : montant, transactionId (Orange), méthode
 *
 * Format SMS Orange Money Madagascar :
 * "Vous avez recu un transfert de 51300Ar venant du 0324931896
 *  Nouveau Solde: 51328Ar. Trans Id: PP251104.0841.D87534. Orange Money vous remercie."
 */
exports.parseSMS = (smsBody) => {
  if (!smsBody) return null;

  const text = smsBody.toUpperCase();

  // ── Détecter la méthode ──────────────────────────────────────
  if (!text.includes("ORANGE")) return null;
  const method = "Orange Money";

  // ── Extraire le montant ──────────────────────────────────────
  // Formats : "51300Ar", "5 000 Ar", "5,000 MGA", "5000ariary"
  const amountMatch = smsBody.match(/([\d][\d\s,.]*)[\s]*(Ar|MGA|ariary)/i);
  let amount = null;
  if (amountMatch) {
    const cleaned = amountMatch[1].replace(/[\s,.]/g, "");
    amount = parseFloat(cleaned);
  }

  // ── Orange Money : extraire l'ID de transaction ──────────────
  // Format : PP251104.0841.D87534 ou MP250414.1234.AB1234
  const transIdMatch = smsBody.match(/Trans\s*Id[:\s]+([A-Z]{2}\d{6}\.\d{4,6}\.[A-Z0-9]+)/i);
  if (!transIdMatch) return null;
  const transactionId = transIdMatch[1].toUpperCase();
  return { method, transactionId, amount };
};
