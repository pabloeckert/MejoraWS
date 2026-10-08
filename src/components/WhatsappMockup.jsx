export function WhatsappMockup({ texto, nombreContacto }) {
  const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden flex flex-col">
      <div className="bg-[#075E54] text-white px-3 py-2 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center text-xs font-medium">
          {(nombreContacto || '?').trim().charAt(0).toUpperCase()}
        </div>
        <div className="leading-tight min-w-0">
          <p className="text-xs font-medium truncate">{nombreContacto}</p>
          <p className="text-[10px] text-white/70">en línea</p>
        </div>
      </div>

      <div className="flex-1 p-3 min-h-[150px] bg-[#ECE5DD] flex justify-end items-start">
        {texto ? (
          <div className="max-w-[85%] bg-[#DCF8C6] rounded-lg rounded-tr-sm px-2.5 py-1.5 shadow-sm">
            <p className="text-[13px] text-[#111B21] whitespace-pre-wrap break-words leading-snug">{texto}</p>
            <p className="text-[10px] text-[#667781] text-right mt-0.5 flex items-center justify-end gap-1">
              {hora}
              <span className="text-[#53BDEB] font-bold tracking-tighter">✓✓</span>
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#667781] m-auto">Escribí el mensaje y lo vas a ver acá</p>
        )}
      </div>

      <p className="text-[10px] text-mc-gris px-2 py-1 bg-gray-50 border-t border-gray-100">
        Así lo va a ver {nombreContacto}
      </p>
    </div>
  )
}
