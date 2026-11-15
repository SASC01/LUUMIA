import type { ReferenceDelivery } from "./api";

const checkedAt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City",
});

const deliveryLabel: Record<ReferenceDelivery["mode"], string> = {
  live: "Consulta en vivo",
  cache: "Consulta reciente guardada en memoria",
  snapshot: "Respaldo precargado",
};

export function ReferenceStatus({ delivery }: { delivery: ReferenceDelivery }) {
  return <div className="reference-status" role="status">
    <p><span className={`tag ${delivery.mode === "snapshot" ? "tag-simulated_assumption" : "tag-observed"}`}>
      {deliveryLabel[delivery.mode]}
    </span>{" "}<small className="muted">{delivery.mode === "snapshot" ? "Intento de consulta del " : "Consulta al proveedor del "}<time dateTime={delivery.attempted_at}>
      {checkedAt.format(new Date(delivery.attempted_at))}</time> · Hora de Campeche</small></p>
    {delivery.fallback_reason && <p className="small muted">{delivery.fallback_reason}</p>}
  </div>;
}
