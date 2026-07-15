const DELIVERY_TYPES = ["quiz", "tarea", "proyecto_parcial", "examen", "proyecto_final"];

/**
 * Canvas no tiene un campo equivalente a nuestros "tipos de entrega", así
 * que lo inferimos con una heurística simple a partir del nombre y los
 * metadatos de la tarea. Es una aproximación, no una clasificación exacta;
 * ajusta este archivo si ves clasificaciones raras en tu curso real.
 */
function classifyDeliveryType(assignment) {
  const name = (assignment.name || "").toLowerCase();
  const submissionTypes = assignment.submission_types || [];
  const points = assignment.points_possible || 0;

  if (assignment.is_quiz_assignment || submissionTypes.includes("online_quiz")) {
    return "quiz";
  }
  if (name.includes("proyecto final") || name.includes("proyecto de fin de")) {
    return "proyecto_final";
  }
  if (name.includes("proyecto")) {
    return "proyecto_parcial";
  }
  if (name.includes("examen") || name.includes("parcial")) {
    return "examen";
  }
  if (name.includes("quiz") || name.includes("lección") || name.includes("leccion")) {
    return "quiz";
  }
  if (points >= 40) {
    return "examen";
  }
  if (points > 0 && points <= 12) {
    return "quiz";
  }
  return "tarea";
}

module.exports = { classifyDeliveryType, DELIVERY_TYPES };
