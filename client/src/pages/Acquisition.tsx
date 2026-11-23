import { useLocation } from "wouter";
import { ContentSection } from "@/components/acquisition/ContentSection";
import { StatsSection } from "@/components/acquisition/StatsSection";
import { CarouselEditor } from "@/components/content/editor/CarouselEditor";

const CONTENT_PATH = "/acquisition/contenu";

/**
 * Acquisition: stats of the member's TikTok accounts (/acquisition) and content creation
 * (/acquisition/contenu, a carousel opening its editor at /acquisition/contenu/:id), listed as
 * sub-pages of "Acquisition" in the sidebar (AppSidebar).
 */
export default function Acquisition() {
  const [location] = useLocation();
  if (location.startsWith(`${CONTENT_PATH}/`)) {
    const carouselId = location.slice(CONTENT_PATH.length + 1);
    return <CarouselEditor key={carouselId} id={carouselId} />;
  }
  return location === CONTENT_PATH ? <ContentSection /> : <StatsSection />;
}
