function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

function canvasBaseUrl() {
  return requireEnv("CANVAS_BASE_URL").replace(/\/+$/, "");
}

/** Sigue los enlaces "next" del header Link de Canvas para traer todas las páginas. */
async function canvasFetchAllPages(path, token) {
  let url = `${canvasBaseUrl()}${path}`;
  const results = [];

  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Canvas respondió ${res.status} para ${url}: ${body.slice(0, 300)}`);
    }
    const page = await res.json();
    results.push(...page);

    const link = res.headers.get("link") || "";
    const nextPart = link.split(",").find((part) => part.includes('rel="next"'));
    const match = nextPart ? nextPart.match(/<([^>]+)>/) : null;
    url = match ? match[1] : null;
  }

  return results;
}

function getActiveCourses(token) {
  return canvasFetchAllPages("/api/v1/courses?enrollment_state=active&per_page=50&include[]=term", token);
}

function getCourseAssignments(courseId, token) {
  return canvasFetchAllPages(
    `/api/v1/courses/${courseId}/assignments?per_page=100&include[]=submission`,
    token
  );
}

module.exports = { getActiveCourses, getCourseAssignments };
