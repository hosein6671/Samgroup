export type ProductDetailEditorial = {
  readonly image: { readonly src: string; readonly alt: string; readonly caption: string };
  readonly selection: {
    readonly eyebrow: string;
    readonly heading: string;
    readonly introduction: string;
    readonly criteria: readonly { readonly title: string; readonly detail: string }[];
  };
};

const EDITORIAL_BY_FAMILY: Readonly<Record<string, ProductDetailEditorial>> = {
  "lubricant-additives": {
    image: {
      src: "/images/lubricant-additives-lab-samples.webp",
      alt: "Laboratory samples representing lubricant additive evaluation",
      caption: "Representative family laboratory samples — not product packaging.",
    },
    selection: {
      eyebrow: "Additive selection brief",
      heading: "Match the component to the finished-fluid target.",
      introduction:
        "Additive selection starts with the intended formulation, base-stock system and performance target. Share the context before treating a product name as a complete recommendation.",
      criteria: [
        {
          title: "Finished-fluid application",
          detail: "State the lubricant type and intended service.",
        },
        {
          title: "Base-stock context",
          detail: "Identify the base oil or blend system where known.",
        },
        {
          title: "Performance target",
          detail: "Reference the required specification, test or claim.",
        },
        {
          title: "Treat rate and evaluation",
          detail: "Confirm these through the applicable technical data and testing route.",
        },
      ],
    },
  },
  "engine-oils-automotive-lubricants": {
    image: {
      src: "/images/engine-oils-automotive-lab-samples.webp",
      alt: "Automotive lubricant samples under laboratory review",
      caption: "Representative automotive lubricant samples — not product packaging.",
    },
    selection: {
      eyebrow: "Automotive selection brief",
      heading: "Start with the vehicle, viscosity and required specification.",
      introduction:
        "A product name is only the first filter. Confirm the application, viscosity grade and the specification required by the equipment or market before ordering.",
      criteria: [
        { title: "Vehicle or equipment", detail: "Share the engine, transmission or system type." },
        {
          title: "Viscosity grade",
          detail: "Use the grade required for the operating conditions.",
        },
        {
          title: "Specification reference",
          detail: "State the API, ACEA, OEM or other requirement where applicable.",
        },
        {
          title: "Pack and destination",
          detail: "Include quantity, packaging preference and delivery market.",
        },
      ],
    },
  },
  "industrial-oils-lubricants": {
    image: {
      src: "/images/industrial-oils-lab-samples.webp",
      alt: "Industrial lubricant samples in a quality-control laboratory",
      caption: "Representative industrial-fluid samples — not product packaging.",
    },
    selection: {
      eyebrow: "Industrial selection brief",
      heading: "Define the machine, duty cycle and operating environment.",
      introduction:
        "Industrial lubricant selection depends on the equipment and service conditions. A clear operating brief helps separate a nominally similar grade from the right supply option.",
      criteria: [
        { title: "Equipment", detail: "Name the machine, component or circulation system." },
        {
          title: "Operating conditions",
          detail: "Include load, temperature, speed and contamination risks where known.",
        },
        {
          title: "Required grade",
          detail: "Share the viscosity grade or equipment specification.",
        },
        {
          title: "Service objective",
          detail:
            "Identify priorities such as wear control, oxidation stability or water separation.",
        },
      ],
    },
  },
  "marine-oils-lubricants": {
    image: {
      src: "/images/marine-oils-lab-samples.webp",
      alt: "Marine lubricant samples prepared for laboratory assessment",
      caption: "Representative marine lubricant samples — not product packaging.",
    },
    selection: {
      eyebrow: "Marine selection brief",
      heading: "Identify the onboard system and its operating requirement.",
      introduction:
        "Marine applications cover different machinery and service regimes. Confirm the vessel system, fuel or operating context and required specification before supply is agreed.",
      criteria: [
        {
          title: "Onboard application",
          detail: "State the engine, gear, hydraulic or auxiliary system.",
        },
        {
          title: "Operating context",
          detail: "Share duty, fuel and environmental conditions where relevant.",
        },
        {
          title: "Grade and specification",
          detail: "Provide the required viscosity and maker or industry reference.",
        },
        {
          title: "Port and quantity",
          detail: "Include delivery port, volume and packaging or bulk requirement.",
        },
      ],
    },
  },
  "antifreeze-coolants": {
    image: {
      src: "/images/antifreeze-coolants-lab-samples.webp",
      alt: "Antifreeze and coolant samples in a laboratory setting",
      caption: "Representative coolant-family samples — not product packaging.",
    },
    selection: {
      eyebrow: "Coolant selection brief",
      heading: "Confirm chemistry, concentration and system compatibility.",
      introduction:
        "Colour alone does not define coolant performance or compatibility. Use the equipment requirement, coolant chemistry and intended dilution or ready-mix condition to guide selection.",
      criteria: [
        {
          title: "Equipment and metallurgy",
          detail: "Identify the cooling system and manufacturer requirement.",
        },
        {
          title: "Coolant chemistry",
          detail: "State the required technology or reference specification.",
        },
        {
          title: "Supply concentration",
          detail: "Confirm concentrate or ready-mixed fluid and the target protection level.",
        },
        {
          title: "Existing fill",
          detail: "Record the current coolant where compatibility or changeover matters.",
        },
      ],
    },
  },
};

export function getProductDetailEditorial(familySlug: string): ProductDetailEditorial {
  return EDITORIAL_BY_FAMILY[familySlug] ?? EDITORIAL_BY_FAMILY["industrial-oils-lubricants"]!;
}
