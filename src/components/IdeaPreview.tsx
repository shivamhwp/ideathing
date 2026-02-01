import {
  ArrowFatUpIcon,
  CalendarCheckIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ImageIcon,
  LinkSimpleIcon,
  NoteIcon,
  UserIcon,
  YoutubeLogoIcon,
} from "@phosphor-icons/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { format, isValid, parseISO } from "date-fns";
import { isConvexStorageId } from "@/lib/storage";

interface IdeaPreviewProps {
  title: string;
  description: string;
  notes: string;
  thumbnail: string;
  thumbnailPreview: string | null;
  thumbnailReady: boolean;
  resources: string[];
  vodRecordingDate: string;
  releaseDate: string;
  owner: string;
  channel: string;
  potential: string | number;
  label: string;
  status: string;
  adReadTracker: string;
  unsponsored: boolean;
  streamMode?: boolean;
}

const formatDateValue = (value: string) => {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, "MMM d") : null;
};

function ThumbnailImage({ thumbnail }: { thumbnail: string }) {
  const storageUrl = useQuery(
    api.files.getUrl,
    isConvexStorageId(thumbnail) ? { storageId: thumbnail as Id<"_storage"> } : "skip",
  );
  const imageUrl = isConvexStorageId(thumbnail) ? storageUrl : thumbnail;

  if (!imageUrl) return null;
  return <img src={imageUrl} alt="Video thumbnail" className="w-full h-full object-cover" />;
}

function Tag({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "primary" | "secondary" | "muted" | "destructive";
}) {
  const variantStyles = {
    default: "bg-muted/60 text-muted-foreground",
    primary: "bg-primary/15 text-primary",
    secondary: "bg-secondary/40 text-secondary-foreground",
    muted: "bg-muted/40 text-muted-foreground",
    destructive: "bg-destructive/15 text-destructive",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}

export function IdeaPreview({
  title,
  description,
  notes,
  thumbnail,
  thumbnailPreview,
  thumbnailReady,
  resources,
  vodRecordingDate,
  releaseDate,
  owner,
  channel,
  potential,
  label,
  status,
  adReadTracker,
  unsponsored,
  streamMode = false,
}: IdeaPreviewProps) {
  const recorded = status === "Recorded";
  const currentThumbnail = thumbnailPreview || thumbnail;
  const filteredResources = resources.map((r) => r.trim()).filter(Boolean);
  const vodDate = formatDateValue(vodRecordingDate);
  const relDate = formatDateValue(releaseDate);

  const getLabelVariant = (
    label: string,
  ): "default" | "primary" | "secondary" | "muted" | "destructive" => {
    switch (label) {
      case "Priority":
      case "Strict deadline":
        return "destructive";
      case "Mid Priority":
      case "High Effort":
        return "secondary";
      case "Sponsored":
        return "primary";
      default:
        return "muted";
    }
  };

  const getStatusVariant = (
    status: string,
  ): "default" | "primary" | "secondary" | "muted" | "destructive" => {
    switch (status) {
      case "Published":
      case "Scheduled":
      case "Ready To Publish":
        return "primary";
      case "Editing":
      case "Done Editing":
      case "Recorded":
        return "secondary";
      case "dead":
        return "destructive";
      default:
        return "muted";
    }
  };

  const labelVariant = getLabelVariant(label);

  return (
    <div>
      {/* Thumbnail */}
      <div className="relative w-full aspect-video bg-muted">
        {currentThumbnail ? (
          thumbnailPreview ? (
            <img src={thumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover" />
          ) : (
            <ThumbnailImage thumbnail={thumbnail} />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-sm text-muted-foreground">No thumbnail</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Title & Description */}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold leading-tight">{title || "Untitled idea"}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>

        {/* Resources - directly below title/desc */}
        {filteredResources.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-medium text-muted-foreground">Resources</span>
              <hr></hr>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filteredResources.map((resource, index) => (
                <a
                  key={`resource-${index}`}
                  href={resource.startsWith("http") ? resource : `https://${resource}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <LinkSimpleIcon weight="bold" className="w-3 h-3" />
                  <span className="truncate max-w-[180px]">{resource}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Tags Grid */}
        <div className="flex flex-wrap gap-1.5">
          {owner && (
            <Tag>
              <UserIcon weight="bold" className="w-3 h-3" />
              {owner}
            </Tag>
          )}
          {channel && (
            <Tag>
              <YoutubeLogoIcon weight="bold" className="w-3 h-3" />
              {channel.replace("C:", "")}
            </Tag>
          )}
          {label && <Tag variant={labelVariant}>{label}</Tag>}
          {status && <Tag variant={getStatusVariant(status)}>{status}</Tag>}
          {potential !== "" && (
            <Tag variant="secondary">
              <ArrowFatUpIcon weight="fill" className="w-3 h-3" />
              {potential}/10
            </Tag>
          )}
          {vodDate && (
            <Tag>
              <ClockIcon weight="bold" className="w-3 h-3" />
              VOD {vodDate}
            </Tag>
          )}
          {relDate && (
            <Tag>
              <CalendarCheckIcon weight="bold" className="w-3 h-3" />
              Release {relDate}
            </Tag>
          )}
          <Tag variant={recorded ? "primary" : "muted"}>
            <CheckCircleIcon weight={recorded ? "fill" : "regular"} className="w-3 h-3" />
            {recorded ? "Recorded" : "Not recorded"}
          </Tag>
          {!streamMode && (
            <Tag variant={unsponsored ? "muted" : "primary"}>
              <CurrencyDollarIcon weight={unsponsored ? "regular" : "fill"} className="w-3 h-3" />
              {unsponsored ? "Unsponsored" : "Sponsored"}
            </Tag>
          )}
          {!streamMode && adReadTracker && (
            <span className="opacity-50">
              <Tag variant="secondary">{adReadTracker}</Tag>
            </span>
          )}
          <Tag variant={thumbnailReady ? "primary" : "muted"}>
            <ImageIcon weight={thumbnailReady ? "fill" : "regular"} className="w-3 h-3" />
            Thumb {thumbnailReady ? "ready" : "pending"}
          </Tag>
        </div>

        {/* Notes */}
        {notes && (
          <div className="pt-2 border-t border-border/40">
            <div className="flex items-center gap-1.5 mb-2">
              <NoteIcon weight="bold" className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Notes</span>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto [&::-webkit-scrollbar]:hidden">
              {notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
