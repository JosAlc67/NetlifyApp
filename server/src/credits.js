/**
 * Créditos por materia. Se busca primero por course_code (el código exacto
 * de Canvas, ej. "MATG1013-VIRTUAL-NRC1234") y si no aparece, por el
 * nombre del curso normalizado. Todo lo que no esté aquí usa DEFAULT_CREDITS
 * mientras se comparte el listado real de carreras/materias/créditos.
 */
const DEFAULT_CREDITS = 3;

const CREDITS_BY_COURSE_CODE = {
  // "MATG1013": 3,
};

const CREDITS_BY_NAME = {
  // "cálculo i": 3,
};

function normalize(str) {
  return (str || "").trim().toLowerCase();
}

function getCreditsForCourse(course) {
  if (course.course_code) {
    for (const [code, credits] of Object.entries(CREDITS_BY_COURSE_CODE)) {
      if (course.course_code.startsWith(code)) return credits;
    }
  }
  const byName = CREDITS_BY_NAME[normalize(course.name)];
  if (byName != null) return byName;
  return DEFAULT_CREDITS;
}

module.exports = { getCreditsForCourse, DEFAULT_CREDITS };
