export type CommerceProductType = "simple" | "variable" | "external" | "grouped";

export function resolveCommerceProductType(typeName: string): CommerceProductType {
  if (typeName === "VariableProduct") return "variable";
  if (typeName === "ExternalProduct") return "external";
  if (typeName === "GroupProduct") return "grouped";
  return "simple";
}
