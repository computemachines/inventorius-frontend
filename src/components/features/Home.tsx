// src/components/features/Home.tsx
// Fully human reviewed: NO
// Progress: NONE
//
// Conversation:
// > (no discussion yet)


import * as React from "react";
import { useFrontload } from "react-frontload";
import { FrontloadContext } from "../../api-client/api-client";
import { Stats } from "../../api-client/data-models";
import ItemLabel from "../primitives/ItemLabel";
import { Link } from "react-router-dom";

/**
 * Home page component
 *
 * Shows general statistics, recent items, and quick links.
 */
function Home() {
  const { data, frontloadMeta } = useFrontload(
    "home-component",
    async ({ api }: FrontloadContext) => {
      const stats = await api.getStats();
      return { stats };
    }
  );

  if (frontloadMeta.pending) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="h-24 bg-gray-300 rounded"></div>
            <div className="h-24 bg-gray-300 rounded"></div>
            <div className="h-24 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (frontloadMeta.error) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Failed to load statistics. Please try again later.
        </div>
      </div>
    );
  }

  const stats: Stats = data.stats;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Bins"
          count={stats.counts.bins}
          linkTo="/new/bin"
          linkLabel="+ New"
          color="blue"
        />
        <StatCard
          label="SKUs"
          count={stats.counts.skus}
          linkTo="/new/sku"
          linkLabel="+ New"
          color="green"
        />
        <StatCard
          label="Batches"
          count={stats.counts.batches}
          linkTo="/new/batch"
          linkLabel="+ New"
          color="amber"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <QuickActionLink to="/receive" label="Receive Items" />
          <QuickActionLink to="/release" label="Release Items" />
          <QuickActionLink to="/move" label="Move Items" />
          <QuickActionLink to="/search" label="Search" />
          <QuickActionLink to="/audit" label="Audit" />
        </div>
      </div>

      {/* Recent Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Bins */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Recent Bins
          </h2>
          {stats.recent_bins.length > 0 ? (
            <ul className="space-y-2">
              {stats.recent_bins.map((bin) => (
                <li key={bin.id} className="flex items-center justify-between py-1">
                  <ItemLabel label={bin.id} />
                  {bin.props && Object.keys(bin.props).length > 0 && (
                    <span className="text-xs text-gray-400">
                      {Object.keys(bin.props).length} prop{Object.keys(bin.props).length !== 1 ? "s" : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm italic">No bins yet</p>
          )}
        </div>

        {/* Recent SKUs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Recent SKUs
          </h2>
          {stats.recent_skus.length > 0 ? (
            <ul className="space-y-2">
              {stats.recent_skus.map((sku) => (
                <li key={sku.id} className="flex items-center justify-between py-1">
                  <ItemLabel label={sku.id} />
                  {sku.name && (
                    <span className="text-xs text-gray-500 truncate ml-2 max-w-[120px]">
                      {sku.name}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm italic">No SKUs yet</p>
          )}
        </div>
      </div>

      {/* Version info */}
      <div className="mt-8 text-center text-xs text-gray-400">
        Frontend v{process.env.VERSION}
      </div>
    </div>
  );
}

function StatCard({
  label,
  count,
  linkTo,
  linkLabel,
  color,
}: {
  label: string;
  count: number;
  linkTo: string;
  linkLabel: string;
  color: "blue" | "green" | "amber";
}) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-600",
    green: "bg-green-50 border-green-200 text-green-600",
    amber: "bg-amber-50 border-amber-200 text-amber-600",
  };

  const countColorClasses = {
    blue: "text-blue-700",
    green: "text-green-700",
    amber: "text-amber-700",
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Link
          to={linkTo}
          className="text-xs hover:underline opacity-70 hover:opacity-100"
        >
          {linkLabel}
        </Link>
      </div>
      <div className={`text-3xl font-bold mt-1 ${countColorClasses[color]}`}>
        {count.toLocaleString()}
      </div>
    </div>
  );
}

function QuickActionLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
    >
      {label}
    </Link>
  );
}

export default Home;
