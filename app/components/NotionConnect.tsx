import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Database, X, Check, AlertCircle, RefreshCw } from "lucide-react";

export function NotionConnect() {
  const [showModal, setShowModal] = useState(false);
  const connection = useQuery(api.notion.getConnection);

  if (connection === undefined) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
          connection
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        <Database className="w-4 h-4" />
        <span className="text-sm font-medium">
          {connection ? "Connected" : "Connect Notion"}
        </span>
        {connection && <Check className="w-4 h-4" />}
      </button>

      {showModal && (
        <NotionConnectModal
          onClose={() => setShowModal(false)}
          isConnected={!!connection}
        />
      )}
    </>
  );
}

function NotionConnectModal({
  onClose,
  isConnected,
}: {
  onClose: () => void;
  isConnected: boolean;
}) {
  const [integrationToken, setIntegrationToken] = useState("");
  const [databaseId, setDatabaseId] = useState("");
  const [targetSection, setTargetSection] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useMutation(api.notion.connect);
  const disconnect = useMutation(api.notion.disconnect);
  const testConnection = useMutation(api.notion.testConnection);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!integrationToken.trim() || !databaseId.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Test the connection first
      const result = await testConnection({
        integrationToken: integrationToken.trim(),
        databaseId: databaseId.trim(),
      });

      if (!result.success) {
        setError(result.error || "Failed to connect to Notion");
        return;
      }

      // Save the connection
      await connect({
        integrationToken: integrationToken.trim(),
        databaseId: databaseId.trim(),
        targetSection: targetSection.trim() || "Vid It",
      });

      onClose();
    } catch (err) {
      setError("Failed to connect. Please check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {isConnected ? "Notion Connection" : "Connect to Notion"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {isConnected ? (
          <div className="p-6">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg mb-6">
              <Check className="w-6 h-6 text-emerald-600" />
              <div>
                <p className="font-medium text-emerald-800">
                  Connected to Notion
                </p>
                <p className="text-sm text-emerald-600">
                  Your ideas will sync when moved to "Vid It"
                </p>
              </div>
            </div>

            <button
              onClick={handleDisconnect}
              className="w-full px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="p-6 space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div>
              <label
                htmlFor="token"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Integration Token <span className="text-red-500">*</span>
              </label>
              <input
                id="token"
                type="password"
                value={integrationToken}
                onChange={(e) => setIntegrationToken(e.target.value)}
                placeholder="secret_..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Create an integration at{" "}
                <a
                  href="https://www.notion.so/my-integrations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  notion.so/my-integrations
                </a>
              </p>
            </div>

            <div>
              <label
                htmlFor="database"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Database ID <span className="text-red-500">*</span>
              </label>
              <input
                id="database"
                type="text"
                value={databaseId}
                onChange={(e) => setDatabaseId(e.target.value)}
                placeholder="abc123..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Copy the ID from your Notion database URL
              </p>
            </div>

            <div>
              <label
                htmlFor="section"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Target Section Name
              </label>
              <input
                id="section"
                type="text"
                value={targetSection}
                onChange={(e) => setTargetSection(e.target.value)}
                placeholder="Vid It (default)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                The name of the status/section in your Notion database where
                items should be added
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  !integrationToken.trim() ||
                  !databaseId.trim() ||
                  isSubmitting
                }
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting && (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                )}
                {isSubmitting ? "Connecting..." : "Connect"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
