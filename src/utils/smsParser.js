/**
 * Parse un SMS de confirmation de paiement Mobile Money
 * Détecte : Orange Money, Airtel Money
 * Extrait : montant, motif KB-XXXX, méthode
 */
exports.parseSMS = (smsBody) => {
  if (!smsBody) return null;

  const text = smsBody.toUpperCase();

  // Détecter la méthode
  let method = null;
  if (text.includes("ORANGE") || text.includes("ORANGE MONEY")) method = "Orange Money";
  else if (text.includes("AIRTEL") || text.includes("AIRTEL MONEY")) method = "Airtel Money";

  if (!method) return null;

  // Extraire le motif KB-XXXX (obligatoire)
  const motifMatch = smsBody.match(/KB-[A-Z0-9]{4}/i);
  if (!motifMatch) return null;
  const motif = motifMatch[0].toUpperCase();

  // Extraire le montant
  // Formats possibles : "5000 Ar", "5,000 Ar", "5 000 MGA", "5000ariary"
  const amountMatch = smsBody.match(/(\d[\d\s.,]*)\s*(AR|MGA|Ar|ariary)/i);
  let amount = null;
  if (amountMatch) {
    // Nettoyer : retirer espaces et virgules, garder les chiffres
    const cleaned = amountMatch[1].replace(/[\s,]/g, "");
    amount = parseFloat(cleaned);
  }

  return { method, motif, amount };
};
