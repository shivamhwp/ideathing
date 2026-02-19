import {
  CassetteTapeIcon,
  GearSixIcon,
  HouseIcon,
  NotionLogoIcon,
  PlusIcon,
  ShareNetworkIcon,
} from "@phosphor-icons/react";
import { useUser } from "@clerk/tanstack-react-start";
import { useHotkey, useHotkeySequence } from "@tanstack/react-hotkeys";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useTheoMode } from "@/hooks/useTheoMode";
import { commandMenuOpenAtom, openAddIdeaModalAtom } from "@/store/atoms";

const CHORD_RESET_MS = 650;

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
};

export function AppCommandCenter() {
  const { isSignedIn } = useUser();
  const { isTheoMode, isCheckingMode } = useTheoMode();
  const [open, setOpen] = useAtom(commandMenuOpenAtom);
  const openAddIdeaModal = useSetAtom(openAddIdeaModalAtom);
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [query, setQuery] = useState("");

  const runCommand = useCallback(
    (id: string) => {
      if (!isSignedIn) {
        return;
      }

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
    [isSignedIn, navigate, openAddIdeaModal, pathname, setOpen],
  );

  const commands = useMemo(() => {
    const list = [
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
            <Kbd>g</Kbd>
            <Kbd>h</Kbd>
          </KbdGroup>
        ),
        icon: HouseIcon,
      },
    ];

    if (!isCheckingMode && !isTheoMode) {
      list.push({
        id: "recorded",
        label: "Go to Recorded Videos",
        hint: (
          <KbdGroup>
            <Kbd>r</Kbd>
            <Kbd>v</Kbd>
          </KbdGroup>
        ),
        icon: CassetteTapeIcon,
      });
    }

    if (!isCheckingMode && isTheoMode) {
      list.splice(2, 0, {
        id: "settings-notion",
        label: "Go to Notion Settings",
        hint: (
          <KbdGroup>
            <Kbd>n</Kbd>
            <Kbd>c</Kbd>
          </KbdGroup>
        ),
        icon: NotionLogoIcon,
      });
    }

    return list;
  }, [isCheckingMode, isTheoMode]);

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return commands;
    return commands.filter((command) =>
      `${command.id} ${command.label}`.toLowerCase().includes(normalizedQuery),
    );
  }, [commands, query]);

  useEffect(() => {
    if (!isSignedIn && open) {
      setOpen(false);
    }
  }, [isSignedIn, open, setOpen]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  useHotkey(
    { key: "K", meta: true },
    () => {
      setOpen((prev) => !prev);
    },
    { enabled: isSignedIn, requireReset: true },
  );

  useHotkey(
    "A",
    () => {
      runCommand("add");
    },
    { enabled: isSignedIn && !open, ignoreInputs: true, requireReset: true },
  );

  useHotkeySequence(
    ["G", "S"],
    (event) => {
      if (event.defaultPrevented || event.isComposing || isEditableTarget(event.target)) return;
      event.preventDefault();
      runCommand("settings-profile");
    },
    {
      enabled: isSignedIn && !open,
      timeout: CHORD_RESET_MS,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkeySequence(
    ["G", "H"],
    (event) => {
      if (event.defaultPrevented || event.isComposing || isEditableTarget(event.target)) return;
      event.preventDefault();
      runCommand("home");
    },
    {
      enabled: isSignedIn && !open,
      timeout: CHORD_RESET_MS,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkeySequence(
    ["S", "L"],
    (event) => {
      if (event.defaultPrevented || event.isComposing || isEditableTarget(event.target)) return;
      event.preventDefault();
      runCommand("settings-shared");
    },
    {
      enabled: isSignedIn && !open,
      timeout: CHORD_RESET_MS,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkeySequence(
    ["R", "V"],
    (event) => {
      if (event.defaultPrevented || event.isComposing || isEditableTarget(event.target)) return;
      event.preventDefault();
      runCommand("recorded");
    },
    {
      enabled: isSignedIn && !open && !isCheckingMode && !isTheoMode,
      timeout: CHORD_RESET_MS,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkeySequence(
    ["N", "C"],
    (event) => {
      if (event.defaultPrevented || event.isComposing || isEditableTarget(event.target)) return;
      event.preventDefault();
      runCommand("settings-notion");
    },
    {
      enabled: isSignedIn && !open && !isCheckingMode && isTheoMode,
      timeout: CHORD_RESET_MS,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  if (!isSignedIn) {
    return null;
  }

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
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="bg-background/45 shadow-2xl shadow-black/30 backdrop-blur-2xl">
        <CommandEmpty>No commands found.</CommandEmpty>
        <CommandGroup heading="Commands">
          {filteredCommands.map((command) => (
            <CommandItem
              key={command.id}
              value={`${command.id} ${command.label}`}
              onSelect={() => runCommand(command.id)}
              className="cursor-pointer rounded-md data-[selected=true]:bg-muted"
            >
              <command.icon className="h-4 w-4" />
              <span>{command.label}</span>
              <span className="ml-auto [&_[data-slot=kbd]]:h-6 [&_[data-slot=kbd]]:min-w-6 [&_[data-slot=kbd]]:px-1.5 [&_[data-slot=kbd]]:text-xs">
                {command.hint}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
        {filteredCommands.length > 0 && (
          <CommandGroup heading="Keyboard Shortcuts">
            <CommandItem disabled className="rounded-md opacity-60">
              <span>Move Focus Left</span>
              <span className="ml-auto [&_[data-slot=kbd]]:h-6 [&_[data-slot=kbd]]:min-w-6 [&_[data-slot=kbd]]:px-1.5 [&_[data-slot=kbd]]:text-xs">
                <KbdGroup>
                  <Kbd>h</Kbd>
                </KbdGroup>
              </span>
            </CommandItem>
            <CommandItem disabled className="rounded-md opacity-60">
              <span>Move Focus Down</span>
              <span className="ml-auto [&_[data-slot=kbd]]:h-6 [&_[data-slot=kbd]]:min-w-6 [&_[data-slot=kbd]]:px-1.5 [&_[data-slot=kbd]]:text-xs">
                <KbdGroup>
                  <Kbd>j</Kbd>
                </KbdGroup>
              </span>
            </CommandItem>
            <CommandItem disabled className="rounded-md opacity-60">
              <span>Move Focus Up</span>
              <span className="ml-auto [&_[data-slot=kbd]]:h-6 [&_[data-slot=kbd]]:min-w-6 [&_[data-slot=kbd]]:px-1.5 [&_[data-slot=kbd]]:text-xs">
                <KbdGroup>
                  <Kbd>k</Kbd>
                </KbdGroup>
              </span>
            </CommandItem>
            <CommandItem disabled className="rounded-md opacity-60">
              <span>Move Focus Right</span>
              <span className="ml-auto [&_[data-slot=kbd]]:h-6 [&_[data-slot=kbd]]:min-w-6 [&_[data-slot=kbd]]:px-1.5 [&_[data-slot=kbd]]:text-xs">
                <KbdGroup>
                  <Kbd>l</Kbd>
                </KbdGroup>
              </span>
            </CommandItem>
            <CommandItem disabled className="rounded-md opacity-60">
              <span>Open Focused Idea</span>
              <span className="ml-auto [&_[data-slot=kbd]]:h-6 [&_[data-slot=kbd]]:min-w-6 [&_[data-slot=kbd]]:px-1.5 [&_[data-slot=kbd]]:text-xs">
                <KbdGroup>
                  <Kbd>enter</Kbd>
                </KbdGroup>
              </span>
            </CommandItem>
            <CommandItem disabled className="rounded-md opacity-60">
              <span>Edit Idea</span>
              <span className="ml-auto [&_[data-slot=kbd]]:h-6 [&_[data-slot=kbd]]:min-w-6 [&_[data-slot=kbd]]:px-1.5 [&_[data-slot=kbd]]:text-xs">
                <KbdGroup>
                  <Kbd>e</Kbd>
                </KbdGroup>
              </span>
            </CommandItem>
            <CommandItem disabled className="rounded-md opacity-60">
              <span>Send to Notion</span>
              <span className="ml-auto [&_[data-slot=kbd]]:h-6 [&_[data-slot=kbd]]:min-w-6 [&_[data-slot=kbd]]:px-1.5 [&_[data-slot=kbd]]:text-xs">
                <KbdGroup>
                  <Kbd>s</Kbd>
                  <Kbd>n</Kbd>
                </KbdGroup>
              </span>
            </CommandItem>
            <CommandItem disabled className="rounded-md opacity-60">
              <span>Delete Idea</span>
              <span className="ml-auto [&_[data-slot=kbd]]:h-6 [&_[data-slot=kbd]]:min-w-6 [&_[data-slot=kbd]]:px-1.5 [&_[data-slot=kbd]]:text-xs">
                <KbdGroup>
                  <Kbd>d</Kbd>
                </KbdGroup>
              </span>
            </CommandItem>
            <CommandItem disabled className="rounded-md opacity-60">
              <span>Add Idea Submit</span>
              <span className="ml-auto [&_[data-slot=kbd]]:h-6 [&_[data-slot=kbd]]:min-w-6 [&_[data-slot=kbd]]:px-1.5 [&_[data-slot=kbd]]:text-xs">
                <KbdGroup>
                  <Kbd>cmd</Kbd>
                  <Kbd>enter</Kbd>
                </KbdGroup>
              </span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
