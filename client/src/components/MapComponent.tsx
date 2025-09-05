import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Empreendimento } from "@shared/schema";

// Configurar ícones do Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Ícone personalizado para empreendimentos
const createCustomIcon = () => {
  return new L.DivIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: #00599C;
        border: 3px solid white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        <div style="
          background-color: white;
          border-radius: 50%;
          width: 8px;
          height: 8px;
        "></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

interface MapComponentProps {
  empreendimentos: Empreendimento[];
  className?: string;
}

// Componente para ajustar o centro do mapa automaticamente
function MapController({ empreendimentos }: { empreendimentos: Empreendimento[] }) {
  const map = useMap();

  useEffect(() => {
    if (empreendimentos.length > 0) {
      const validCoordinates = empreendimentos.filter(
        emp => emp.latitude && emp.longitude
      );

      if (validCoordinates.length === 1) {
        // Se só tem um empreendimento, centraliza nele
        const emp = validCoordinates[0];
        map.setView([parseFloat(emp.latitude!), parseFloat(emp.longitude!)], 13);
      } else if (validCoordinates.length > 1) {
        // Se tem múltiplos, ajusta para mostrar todos
        const bounds = L.latLngBounds(
          validCoordinates.map(emp => [parseFloat(emp.latitude!), parseFloat(emp.longitude!)])
        );
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [empreendimentos, map]);

  return null;
}

export default function MapComponent({ empreendimentos, className }: MapComponentProps) {
  // Filtrar apenas empreendimentos com coordenadas válidas
  const empreendimentosComCoordenadas = empreendimentos.filter(
    emp => emp.latitude && emp.longitude && 
           !isNaN(parseFloat(emp.latitude)) && 
           !isNaN(parseFloat(emp.longitude))
  );

  // Centro padrão do Brasil (Brasília)
  const defaultCenter: [number, number] = [-15.7942, -47.8822];
  const defaultZoom = 4;

  return (
    <div className={`h-96 w-full rounded-lg overflow-hidden shadow-sm ${className || ''}`}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
        data-testid="map-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController empreendimentos={empreendimentosComCoordenadas} />

        {empreendimentosComCoordenadas.map((empreendimento) => (
          <Marker
            key={empreendimento.id}
            position={[parseFloat(empreendimento.latitude!), parseFloat(empreendimento.longitude!)]}
            icon={createCustomIcon()}
          >
            <Popup>
              <div className="p-2 min-w-48" data-testid={`popup-empreendimento-${empreendimento.id}`}>
                <h3 className="font-semibold text-lg text-[#00599C] mb-2">
                  {empreendimento.nome}
                </h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Cliente:</span> {empreendimento.cliente}
                  </p>
                  <p>
                    <span className="font-medium">Localização:</span> {empreendimento.localizacao}
                  </p>
                  <p>
                    <span className="font-medium">Responsável:</span> {empreendimento.responsavelInterno}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    <span className="font-medium">Coordenadas:</span><br/>
                    Lat: {parseFloat(empreendimento.latitude!).toFixed(6)}<br/>
                    Long: {parseFloat(empreendimento.longitude!).toFixed(6)}
                  </p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {empreendimentosComCoordenadas.length === 0 && (
          <div className="absolute top-4 left-4 bg-white p-3 rounded shadow-md border z-[1000]">
            <p className="text-sm text-gray-600">
              Nenhum empreendimento com coordenadas encontrado.
            </p>
          </div>
        )}
      </MapContainer>
    </div>
  );
}