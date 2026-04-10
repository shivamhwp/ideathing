import * as React from "react";
import { useImperativeHandle } from "react";
import { cn } from "@/utils/utils";

interface UseAutosizeTextAreaProps {
  textAreaRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  minHeight?: number;
  maxHeight?: number;
  triggerAutoSize: string;
}

const useAutosizeTextArea = ({
  textAreaRef,
  triggerAutoSize,
  maxHeight = Number.MAX_SAFE_INTEGER,
  minHeight = 0,
}: UseAutosizeTextAreaProps) => {
  React.useEffect(() => {
    const offsetBorder = 6;
    const textAreaElement = textAreaRef.current;
    if (!textAreaElement) return;

    const nextMinHeight = minHeight + offsetBorder;
    textAreaElement.style.minHeight = `${nextMinHeight}px`;
    textAreaElement.style.maxHeight = `${Math.max(maxHeight, nextMinHeight)}px`;

    textAreaElement.style.height = `${nextMinHeight}px`;
    const scrollHeight = textAreaElement.scrollHeight;
    textAreaElement.style.height =
      scrollHeight > maxHeight
        ? `${Math.max(maxHeight, nextMinHeight)}px`
        : `${Math.max(scrollHeight + offsetBorder, nextMinHeight)}px`;
  }, [maxHeight, minHeight, textAreaRef, triggerAutoSize]);
};

export type AutosizeTextAreaRef = {
  textArea: HTMLTextAreaElement;
  maxHeight: number;
  minHeight: number;
  focus: () => void;
};

type AutosizeTextAreaProps = {
  maxHeight?: number;
  minHeight?: number;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const AutosizeTextarea = React.forwardRef<AutosizeTextAreaRef, AutosizeTextAreaProps>(
  (
    { maxHeight = Number.MAX_SAFE_INTEGER, minHeight = 52, className, onChange, value, ...props },
    ref,
  ) => {
    const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const [triggerAutoSize, setTriggerAutoSize] = React.useState("");

    useAutosizeTextArea({
      textAreaRef,
      triggerAutoSize,
      maxHeight,
      minHeight,
    });

    useImperativeHandle(ref, () => ({
      textArea: textAreaRef.current as HTMLTextAreaElement,
      focus: () => textAreaRef.current?.focus(),
      maxHeight,
      minHeight,
    }));

    React.useEffect(() => {
      setTriggerAutoSize((value as string) ?? "");
    }, [props.defaultValue, value]);

    return (
      <textarea
        {...props}
        value={value}
        ref={textAreaRef}
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        onChange={(event) => {
          setTriggerAutoSize(event.target.value);
          onChange?.(event);
        }}
      />
    );
  },
);

AutosizeTextarea.displayName = "AutosizeTextarea";
