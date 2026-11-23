"use client";

import { CrudPage, formatDay, type CrudConfig } from "@/components/crud";
import { deleteTypeSupportLogo, typeSupportsApi, uploadTypeSupportLogo } from "@/lib/api/admin";
import type { TypeSupport } from "@/lib/types";

// Un « type de support » = un fournisseur/niveau de support (nom, email, logo). Ce n'est PAS une catégorie
// de ticket (les catégories sont la « nature » des contrats).
const cfg: CrudConfig<TypeSupport> = {
  title: "Types de support",
  noun: "type de support",
  fields: [
    { name: "supportName", label: "Nom", type: "text", required: true, maxLength: 150 },
    { name: "supportEmail", label: "Email du support", type: "email", required: true, maxLength: 190 },
  ],
  columns: [
    { header: "Nom", render: (t) => <span className="font-medium text-slate-900">{t.supportName}</span> },
    { header: "Email", render: (t) => t.supportEmail },
    { header: "Logo", render: (t) => t.logoUrl ? <img src={t.logoUrl} alt={`Logo ${t.supportName}`} className="h-10 w-10 rounded border border-slate-200 object-contain" /> : "—" },
    { header: "Créé le", render: (t) => formatDay(t.creationDate) },
  ],
  searchText: (t) => `${t.supportName} ${t.supportEmail}`,
  searchPlaceholder: "Rechercher (nom, email)…",
  rowLabel: (t) => `« ${t.supportName} »`,
  ...typeSupportsApi,
  fileField: { name: "logo", label: "Logo PNG, JPEG ou WebP", accept: "image/png,image/jpeg,image/webp" },
  uploadFile: uploadTypeSupportLogo,
  rowActions: (t, reload, ctx) => t.logoUrl ? (
    <button
      className="btn btn-outline-secondary !px-3 !py-1"
      onClick={async () => {
        try {
          await deleteTypeSupportLogo(t.id);
          ctx.setNotice(`Logo de « ${t.supportName} » supprimé.`);
          reload();
        } catch (e) {
          ctx.setError(e instanceof Error ? e.message : "Impossible de supprimer le logo.");
        }
      }}
    >
      Supprimer logo
    </button>
  ) : null,
  toForm: (t) => ({ supportName: t.supportName, supportEmail: t.supportEmail }),
  defaults: { supportName: "", supportEmail: "" },
  validate: (v) => (/^\S+@\S+\.\S+$/.test(String(v.supportEmail ?? "").trim()) ? null : "Adresse email invalide."),
  deleteWarning: () => "Si ce type est encore lié à un contrat, un équipement ou un logiciel, la suppression sera refusée : détachez-le d'abord.",
};

export default function TypeSupportsPage() {
  return <CrudPage cfg={cfg} />;
}
