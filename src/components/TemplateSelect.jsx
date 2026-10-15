/* Shared template picker. Custom (saved) templates are listed first under a
   "My templates" group so they are easy to find, followed by the built-ins. */
export default function TemplateSelect({ templates, value, onChange, className = 'select', style }) {
  const custom = templates.filter((t) => t.custom)
  const builtin = templates.filter((t) => !t.custom)

  return (
    <select
      className={className}
      style={style}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {custom.length > 0 && (
        <optgroup label="My templates">
          {custom.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="Built-in templates">
        {builtin.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </optgroup>
    </select>
  )
}
