/**
 * Parse un SMS de confirmation de paiement Mobile Money
 * Détecte : MVola, Orange Money, Airtel Money
 * Extrait : montant, motif KB-XXXX, méthode
 */
exports.parseSMS = (smsBody) => {
  if (!smsBody) return null;

  const text = smsBody.toUpperCase();

  // Détecter la méthode
  let method = null;
  if (text.includes("MVOLA") || text.includes("M-VOLA")) method = "MVola";
  else if (text.includes("ORANGE MONEY") || text.includes("ORANGEMONEY")) method = "Orange Money";
  else if (text.includes("AIRTEL") || text.includes("AIRTEL MONEY")) method = "Airtel Money";

  if (!method) return null;

  // Extraire le motif KB-XXXX
  const motifMatch = smsBody.match(/KB-[A-Z0-9]{4}/i);
  if (!motifMatch) return null;
  const motif = motifMatch[0].toUpperCase();

  // Extraire le montant (nombre suivi de AR ou MGA ou Ar)
  const amountMatch = smsBody.match(/(\d[\d\s.,]*)\s*(AR|MGA|Ar|ariary)/i);
  const amount = amountMatch
    ? parseFloat(amountMatch[1].replace(/[\s,]/g, "").replace(".", ""))
    : null;

  return { method, motif, amount };
};