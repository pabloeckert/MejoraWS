export function EntregaTicks({ contact }) {
  if (contact.estado !== 'enviado' && !contact.entregaStatus) {
    return <span className="text-mc-gris text-xs">-</span>
  }

  const status = contact.entregaStatus || 0
  const cfg =
    status >= 4
      ? { ticks: 2, color: 'text-mc-azul', label: 'Leído', fecha: contact.fechaLeido }
      : status === 3
        ? { ticks: 2, color: 'text-mc-gris', label: 'Llegó al teléfono', fecha: contact.fechaLlego }
        : status === 2
          ? { ticks: 1, color: 'text-mc-gris', label: 'Salió de WhatsApp', fecha: contact.fechaSalio }
          : { ticks: 0, color: 'text-mc-gris', label: 'Esperando confirmación de WhatsApp', fecha: null }

  const title = cfg.fecha ? `${cfg.label} — ${new Date(cfg.fecha).toLocaleString()}` : cfg.label

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cfg.color}`} title={title}>
      {cfg.ticks === 0 ? (
        <span className="text-mc-gris">⏳</span>
      ) : (
        <span className="font-bold tracking-tighter">{cfg.ticks === 2 ? '✓✓' : '✓'}</span>
      )}
      <span className="text-[11px]">{cfg.label.split(' ')[0]}</span>
    </span>
  )
}
