import type { TikTokAccount } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Profile photo of a TikTok account, initial as fallback (the signed TikTok links expire after a few
 * days until the next refresh). no-referrer: the TikTok CDN can refuse hotlinked images.
 */
export function TikTokAvatar({ account, className }: { account: TikTokAccount; className?: string }) {
  return (
    <Avatar className={cn("h-6 w-6", className)}>
      {account.avatar_url && <AvatarImage src={account.avatar_url} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback className="bg-primary/10 text-[0.7em] font-semibold uppercase text-primary">
        {account.handle.slice(0, 1)}
      </AvatarFallback>
    </Avatar>
  );
}
