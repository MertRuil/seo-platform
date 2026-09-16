import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// Politika: derlemeyi gercekten bozan seyler hata, uslup ve React Compiler'in
// katı uyarilari uyari olarak raporlanir. Boylece "npm run lint" gunluk
// kullanimda calisir ve birikmis 98 bulgu yeni gercek hatalari gizlemez.
// Uyarilari zamanla sifira indirip bu gevsetmeleri kaldirmak hedeftir.
const relaxed = {
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": "warn",
    "react/no-unescaped-entities": "warn",
    // React 19 derleyici kurallari: mevcut kodda 13 bulgu var, cogu
    // "mount'ta localStorage'dan oku" kalibi. Kademeli temizlenecek.
    "react-hooks/set-state-in-effect": "warn",
    "react-hooks/immutability": "warn",
    "react-hooks/refs": "warn",
  },
};

export default [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...coreWebVitals,
  ...typescript,
  relaxed,
];
