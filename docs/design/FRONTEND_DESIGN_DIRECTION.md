# Sam Group Frontend Design Direction

> **Status: original brief — superseded in part.** This document records the design _intent_,
> written before any of it was built. The resolved system — colour, typography, spacing, grid,
> motion, and the rules governing them — is [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md), which is
> current where the two differ.
>
> Two items below are specifically out of date: the **Typography** section names Neue Haas
> Grotesk and Helvetica Neue, both commercially licensed and not procured (Inter ships today);
> and the **Animation** section predates the design system's own motion layer, which is
> scroll-driven CSS with no library dependency. GSAP and Framer Motion remain reserved for the
> specific cases named in
> [FRONTEND_ARCHITECTURE.md](../frontend/FRONTEND_ARCHITECTURE.md) §8.
>
> Kept as written, not rewritten: the brief is the record of what was asked for, and the
> intent it states is unchanged.

## Vision

هدف سایت:
یک تجربه دیجیتال لوکس، صنعتی، تکنولوژیک و بین‌المللی.

## Visual Language

- Luxury industrial
- Engineering focused
- Premium B2B
- Global manufacturing identity

## Typography

- Inter
- Neue Haas Grotesk style
- Helvetica Neue style

Characteristics:

- Oversized headlines
- Editorial hierarchy
- Luxury spacing

## Layout Principles

- Avoid generic SaaS layouts
- Avoid standard blog cards
- Magazine-style editorial layouts
- Large visual storytelling

## Animation

- GSAP
- ScrollTrigger
- Framer Motion

Rules:

- Premium
- Smooth
- Performance focused

## 3D Experience

- Three.js
- React Three Fiber
- Drei

Rules:

- Use only when valuable
- Optimize performance
- Provide fallback

## Internationalization

- Unlimited language support
- next-intl
- RTL/LTR support
- Translation ready content
- SEO localization

## CMS Integration

All editable content comes from Payload CMS.

Examples:

- Hero
- Products
- Articles
- Company information
- Contact

## Required Components

- LuxuryHero
- IndustrialGlassPanel
- ProductEcosystem
- GlobalExportMap
- ResearchLaboratory
- ManufacturingJourney
- EditorialInsights
- PartnershipCTA

## Quality Target

The experience should feel like:

Apple launching a global industrial technology company.
