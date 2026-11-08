import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { t as tr, useLocale } from "../i18n";
import { useSaveAction } from "../hooks/useSaveAction";
export function AndroidDeviceList() {
  useLocale();
  const devices = useQuery(api.nativeRecaps.listDevices);
  const revoke = useMutation(api.nativeRecaps.revokeDevice);
  const action = useSaveAction();
  if (!devices?.length) return null;
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="text-sm font-semibold text-white/85">
        {tr("Android recap devices")}
      </h3>
      <p className="mt-2 text-xs leading-5 text-white/50">
        {tr(
          "Remove a device to stop its background access. Your account data stays saved.",
        )}
      </p>
      <div className="mt-2 divide-y divide-white/10">
        {devices.map((device) => (
          <div key={device.id} className="flex min-w-0 items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-white/80">{device.label}</p>
              <p className="mt-1 font-mono text-xs text-white/45">
                {device.code}
              </p>
            </div>
            <button
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await revoke({ deviceId: device.id });
                })
              }
              className="min-h-11 shrink-0 rounded-xl border border-white/10 px-3 text-xs text-white/70 disabled:opacity-40"
            >
              {tr("Remove device")}
            </button>
          </div>
        ))}
      </div>
      {action.error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {action.error}
        </p>
      )}
    </section>
  );
}
