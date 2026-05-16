import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle({ asMenuItem }: { asMenuItem?: boolean } = {}) {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => { setTheme(getStoredTheme()); }, []);
  const set = (t: Theme) => { setTheme(t); applyTheme(t); };

  const icon = theme === "dark"
    ? <Moon className="h-4 w-4" />
    : theme === "light"
    ? <Sun className="h-4 w-4" />
    : <Monitor className="h-4 w-4" />;

  if (asMenuItem) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
          {icon} Theme
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem onClick={() => set("light")}><Sun className="mr-2 h-4 w-4" /> Light</DropdownMenuItem>
          <DropdownMenuItem onClick={() => set("dark")}><Moon className="mr-2 h-4 w-4" /> Dark</DropdownMenuItem>
          <DropdownMenuItem onClick={() => set("system")}><Monitor className="mr-2 h-4 w-4" /> System</DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => set("light")}><Sun className="mr-2 h-4 w-4" /> Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => set("dark")}><Moon className="mr-2 h-4 w-4" /> Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => set("system")}><Monitor className="mr-2 h-4 w-4" /> System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
