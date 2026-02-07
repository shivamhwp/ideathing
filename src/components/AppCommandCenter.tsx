import {
	CassetteTapeIcon,
	GearSixIcon,
	HouseIcon,
	NotionLogoIcon,
	PlusIcon,
	ShareNetworkIcon,
} from "@phosphor-icons/react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { commandMenuOpenAtom, openAddIdeaModalAtom } from "@/store/atoms";

const CHORD_RESET_MS = 700;

const isEditableTarget = (target: EventTarget | null) => {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	return Boolean(
		target.closest("input, textarea, select, [contenteditable='true']"),
	);
};

const shortcutMatches = (combo: string, key: string) => {
	const normalized = key.toLowerCase();
	return combo === normalized;
};

export function AppCommandCenter() {
	const [open, setOpen] = useAtom(commandMenuOpenAtom);
	const openAddIdeaModal = useSetAtom(openAddIdeaModalAtom);
	const navigate = useNavigate();
	const pathname = useLocation({ select: (location) => location.pathname });
	const bufferRef = useRef("");
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const runCommand = useCallback(
		(id: string) => {
			setOpen(false);
			if (id === "add") {
				openAddIdeaModal();
				if (pathname !== "/") void navigate({ to: "/" });
				return;
			}
			if (id === "settings-profile") {
				void navigate({ to: "/settings/profile" });
				return;
			}
			if (id === "settings-notion") {
				void navigate({ to: "/settings/notion" });
				return;
			}
			if (id === "settings-shared") {
				void navigate({ to: "/settings/shared" });
				return;
			}
			if (id === "recorded") {
				void navigate({ to: "/recorded" });
				return;
			}
			if (id === "home") {
				void navigate({ to: "/" });
			}
		},
		[navigate, openAddIdeaModal, pathname, setOpen],
	);

	const commands = useMemo(
		() => [
			{
				id: "add",
				label: "Add Idea",
				hint: (
					<KbdGroup>
						<Kbd>a</Kbd>
					</KbdGroup>
				),
				icon: PlusIcon,
			},
			{
				id: "settings-profile",
				label: "Go to Profile Settings",
				hint: (
					<KbdGroup>
						<Kbd>g</Kbd>
						<Kbd>s</Kbd>
					</KbdGroup>
				),
				icon: GearSixIcon,
			},
			{
				id: "settings-notion",
				label: "Go to Notion Settings",
				hint: (
					<KbdGroup>
						<Kbd>n</Kbd>
						<Kbd>c</Kbd>
					</KbdGroup>
				),
				icon: NotionLogoIcon,
			},
			{
				id: "settings-shared",
				label: "Go to Shared Settings",
				hint: (
					<KbdGroup>
						<Kbd>s</Kbd>
						<Kbd>l</Kbd>
					</KbdGroup>
				),
				icon: ShareNetworkIcon,
			},
			{
				id: "home",
				label: "Go to Home",
				hint: (
					<KbdGroup>
						<Kbd>h</Kbd>
					</KbdGroup>
				),
				icon: HouseIcon,
			},
			{
				id: "recorded",
				label: "Go to Recorded Videos",
				hint: (
					<KbdGroup>
						<Kbd>r</Kbd>
						<Kbd>v</Kbd>
					</KbdGroup>
				),
				icon: CassetteTapeIcon,
			},
		],
		[],
	);

	useEffect(() => {
		const clearChord = () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
			bufferRef.current = "";
		};

		const scheduleReset = () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
			timeoutRef.current = setTimeout(clearChord, CHORD_RESET_MS);
		};

		const chordToCommand = new Map([
			["a", "add"],
			["gs", "settings-profile"],
			["nc", "settings-notion"],
			["sl", "settings-shared"],
			["rv", "recorded"],
			["h", "home"],
		]);
		const sequences = [...chordToCommand.keys()];

		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && shortcutMatches("k", event.key)) {
				event.preventDefault();
				setOpen((prev) => !prev);
				clearChord();
				return;
			}

			if (event.defaultPrevented || event.repeat || event.isComposing) return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (open || isEditableTarget(event.target)) return;

			const key = event.key.toLowerCase();
			if (!/^[a-z]$/.test(key)) {
				clearChord();
				return;
			}

			const buffered = `${bufferRef.current}${key}`;
			const normalized = buffered.length > 2 ? buffered.slice(-2) : buffered;
			const direct = chordToCommand.get(normalized);
			if (direct) {
				event.preventDefault();
				runCommand(direct);
				clearChord();
				return;
			}

			const hasPrefix = sequences.some((value) => value.startsWith(normalized));
			if (hasPrefix) {
				bufferRef.current = normalized;
				scheduleReset();
				return;
			}

			const single = chordToCommand.get(key);
			if (single) {
				event.preventDefault();
				runCommand(single);
				clearChord();
				return;
			}

			if (sequences.some((value) => value.startsWith(key))) {
				bufferRef.current = key;
				scheduleReset();
				return;
			}

			clearChord();
		};

		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			clearChord();
		};
	}, [open, runCommand, setOpen]);

	return (
		<CommandDialog
			open={open}
			onOpenChange={setOpen}
			title="Command Menu"
			description="Search commands and navigate quickly."
			className="top-[5.5rem] translate-y-0 border-border/60 bg-background/45 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:max-w-xl"
		>
			<CommandInput
				placeholder="Type a command or shortcut..."
				className="placeholder:text-muted-foreground/70"
			/>
			<CommandList className="bg-background/45 shadow-2xl shadow-black/30 backdrop-blur-2xl">
				<CommandEmpty>No commands found.</CommandEmpty>
				<CommandGroup heading="Commands">
					{commands.map((command) => (
						<CommandItem
							key={command.id}
							value={`${command.id} ${command.label}`}
							onSelect={() => runCommand(command.id)}
							className="cursor-pointer rounded-md data-[selected=true]:bg-muted"
						>
							<command.icon className="h-4 w-4" />
							<span>{command.label}</span>
							<span className="ml-auto">{command.hint}</span>
						</CommandItem>
					))}
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	);
}
