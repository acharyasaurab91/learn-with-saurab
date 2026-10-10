// ============================================
// XSS Sanitizer
// Strips the most common XSS vectors from string
// values in req.body / req.query before they reach
// route handlers. Non-string values are untouched.
// ============================================

const PATTERNS = [
  // <script ...>...</script> and <iframe ...>...</iframe> (with their content)
  /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi,
  /<\s*iframe\b[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi,
  // stray / unclosed dangerous tags: <script>, </script>, <object>, <embed>, <svg>, <math>
  /<\s*\/?\s*(?:script|iframe|object|embed|svg|math)\b[^>]*>/gi,
  // inline event handlers inside a tag: <img src=x onerror=...> → whole tag removed.
  // Only matches inside an HTML tag, so prose such as "click on=save" is untouched.
  /<[a-zA-Z][^>]*\son[a-z]+\s*=[^>]*>/gi,
  // javascript: URLs — negative lookahead keeps normal prose like "JavaScript: notes"
  /javascript:(?!\s)/gi
];

function cleanString(value) {
  let out = value;
  for (const pattern of PATTERNS) out = out.replace(pattern, '');
  return out;
}

function clean(value) {
  if (typeof value === 'string') return cleanString(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = clean(value[i]);
    return value;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = clean(value[key]);
    return value;
  }
  return value;
}

module.exports = function xssSanitizer(req, res, next) {
  try {
    if (req.body && typeof req.body === 'object') clean(req.body);
    if (req.query && typeof req.query === 'object') {
      const cleanQuery = clean(req.query);
      // Own property so it survives Express re-parsing req.query on access
      Object.defineProperty(req, 'query', {
        value: cleanQuery,
        writable: true,
        configurable: true,
        enumerable: true
      });
    }
  } catch (err) {
    console.error('XSS sanitizer error:', err.message);
  }
  next();
};
