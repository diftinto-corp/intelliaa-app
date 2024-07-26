// hooks/useScreenSize.ts
import { useEffect, useState } from "react";

const useScreenSize = () => {
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  const handleResize = () => {
    setIsSmallScreen(window.innerWidth < 1024); // Ajusta el tamaño según lo que consideres "pantallas pequeñas"
  };

  useEffect(() => {
    handleResize(); // Verifica el tamaño al cargar

    window.addEventListener("resize", handleResize); // Escucha cambios de tamaño

    return () => {
      window.removeEventListener("resize", handleResize); // Limpia el listener
    };
  }, []);

  return isSmallScreen;
};

export default useScreenSize;
