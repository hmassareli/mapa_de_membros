import { forwardRef } from "react";

const PrintableReport = forwardRef(function PrintableReport({ familias }, ref) {
  const editadas = familias.filter((f) => f.endereco_editado);
  const dataHoje = new Date().toLocaleDateString("pt-BR");

  return (
    <div ref={ref} className="hidden print:block p-8 bg-white text-black text-sm">
      <style>{`
        @media print {
          @page { margin: 15mm; size: A4 portrait; }
          body * { visibility: hidden; }
          .print-report, .print-report * { visibility: visible !important; display: revert !important; }
          .print-report { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
      <div className="print-report">
        <h1 className="text-xl font-bold text-center mb-1">
          Relatório de Alterações de Endereço
        </h1>
        <p className="text-xs text-gray-500 text-center mb-4">
          Gerado em: {dataHoje} &bull; Total: {editadas.length} família(s)
        </p>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#1e3a5f] text-white">
              <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-[20%]">Família</th>
              <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-[35%]">Endereço Atualizado</th>
              <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-[20%]">Telefone(s)</th>
              <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-[25%]">Membros</th>
            </tr>
          </thead>
          <tbody>
            {editadas.map((f, i) => {
              const membros = (f.membros || [])
                .map((m) => m.primeiro_nome || m.nome_completo)
                .join(", ");
              const telefones = [
                f.telefone,
                ...(f.membros || []).map((m) => m.telefone).filter(Boolean),
              ]
                .filter(Boolean)
                .filter((v, idx, arr) => arr.indexOf(v) === idx)
                .join(", ");
              const endereco = [f.endereco_linha1, f.endereco_linha2, f.endereco_linha3]
                .filter(Boolean)
                .join(", ");

              return (
                <tr key={f.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="border border-gray-200 px-2 py-1.5 font-medium">{f.nome_familia}</td>
                  <td className="border border-gray-200 px-2 py-1.5">{endereco}</td>
                  <td className="border border-gray-200 px-2 py-1.5">{telefones || "—"}</td>
                  <td className="border border-gray-200 px-2 py-1.5">{membros || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {editadas.length === 0 && (
          <p className="text-center text-gray-400 py-8">Nenhuma família com endereço editado.</p>
        )}
      </div>
    </div>
  );
});

export default PrintableReport;
