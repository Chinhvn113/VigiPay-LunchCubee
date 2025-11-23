import { useEffect, useState } from "react";

export const ScrollProgress = () => {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      
      const scrollableHeight = documentHeight - windowHeight;
      const progress = scrollableHeight > 0 ? (scrollTop / scrollableHeight) * 100 : 0;
      
      setScrollProgress(progress);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div className="fixed right-1.5 top-20 bottom-4 w-1 bg-muted/20 rounded-full z-[100] pointer-events-none">
      <div 
        className="bg-primary/70 w-full rounded-full transition-all duration-150 ease-out"
        style={{ 
          height: `${scrollProgress}%`,
        }}
      />
    </div>
  );
};
