import { MonitorIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const themeOrder = ["system", "dark", "light"] as const;

type ThemeMode = (typeof themeOrder)[number];

const getNextTheme = (current: ThemeMode) => {
	const index = themeOrder.indexOf(current);
	const nextIndex = index === -1 ? 0 : (index + 1) % themeOrder.length;
	return themeOrder[nextIndex];
};

const themeLabels: Record<ThemeMode, string> = {
	system: "System theme",
	dark: "Dark theme",
	light: "Light theme",
};

export function ThemeToggle({ className }: { className?: string }) {
	const { theme, setTheme } = useTheme();
	const currentTheme = (theme ?? "system") as ThemeMode;

	const handleToggle = () => {
		setTheme(getNextTheme(currentTheme));
	};

	const icon =
		currentTheme === "light" ? (
			<SunIcon className="w-4 h-4" weight="duotone" />
		) : currentTheme === "dark" ? (
			<MoonIcon className="w-4 h-4" weight="duotone" />
		) : (
			<MonitorIcon className="w-4 h-4" weight="duotone" />
		);

	return (
		<Button
			variant="secondary"
			size="icon"
			onClick={handleToggle}
			aria-label={`Switch theme (${themeLabels[currentTheme]})`}
			title={`Switch theme (${themeLabels[currentTheme]})`}
			className={className}
		>
			{icon}
		</Button>
	);
}
