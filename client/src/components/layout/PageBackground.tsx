import { ReactNode } from "react";

interface PageBackgroundProps {
  children: ReactNode;
  backgroundImage: string;
  overlayOpacity?: number;
}

export default function PageBackground({ 
  children, 
  backgroundImage,
  overlayOpacity = 0.7 
}: PageBackgroundProps) {
  return (
    <div className="min-h-screen relative">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          zIndex: 0,
        }}
      >
        <div 
          className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/70 backdrop-blur-[1px]"
          style={{ opacity: overlayOpacity }}
        />
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
