This is a comprehensive CSS_CONSTITUTION.md file designed to be stored in your repository. It bridges high-level system philosophy with specific technical implementation rules for native CSS.
CSS Constitution & System Standards
I. Core Philosophy: The System is the Truth

    The "Why" Before the "How": No CSS property should be applied as a "magic number." Every value must have a systemic reason for existing, rooted in the design tokens.

    Component Autonomy: A component must pass the White Page Test: it should render perfectly on a blank page, independent of its parent container or position in the DOM.

    Anti-Rot Principle: Avoid "rat’s nest" CSS where styles depend on deep nesting. If a component only looks correct when nested inside #sidebar .wrapper .content, the architecture has failed.

II. Architectural Layers (@layer)

Use CSS Cascade Layers to explicitly define the order of precedence. This eliminates specificity wars and the need for !important.

    @layer reset: Normalizes browser behavior (e.g., box-sizing, margin resets).

    @layer base: Defines how raw HTML elements (h1, p, table, button) look by default to ensure a cohesive "unclassed" experience.

    @layer theme: The source of truth for design tokens (colors, typography scales, spacing).

    @layer components: Logic for discrete UI elements. Styles here are scoped and encapsulated.

    @layer utilities: Specific, single-purpose overrides.

III. The Token System (Custom Properties)

The design system drives all decisions through CSS Variables.

    Variable-Only Visuals: Hardcoded hex codes, pixels for font sizes, or raw timing values are forbidden in the components layer.

    Type-Safe Tokens: Use @property for critical system variables to define types and control inheritance.

        Example: Set inherits: false on layout-specific variables (like --gutter-gap) to prevent them from leaking into nested children.

    Relative Systems: Derive values mathematically. Use relative color syntax to create hover states or borders from a base token rather than defining a new color.

    Computed Inlines: If a component requires a dynamic variant, pass a CSS variable via an inline style attribute. The CSS should be written to "compute its way out" based on that variable.

IV. Scoping & Encapsulation

    Native Scoping (@scope): Use the @scope API to anchor styles to a component root.

    Donut Scoping: Use "to" limits in scoping to prevent a parent’s styles from bleeding into a nested child of the same type (e.g., @scope (.card) to (.card)).

    Property Unsetting: Use all: unset or initial when creating a "clean slate" for a component that must ignore inherited styles.

V. Intrinsic & Fluid Mechanics

Avoid "rigid" layouts that break and require constant media query patches.

    Fluid Typography: Use clamp() for font sizes and spacing.

        Formula: font-size: clamp([min], [fluid-vw], [max]).

    Intrinsic Sizing: Prioritize grid-template-columns: repeat(auto-fit, minmax(anchor, 1fr)) and flex-wrap: wrap. The UI should respond to the content's needs before the viewport's needs.

    Media Query Strategy: Media queries should primarily be used to update variable values (e.g., updating a --column-count) rather than rewriting entire selectors.

    Vertical Rhythm: Use the lh (line-height) unit for vertical spacing to ensure margins and padding align with the text's natural flow.

VI. Quality Enforcement

    The "Important" Ban: The use of !important is strictly prohibited. If specificity is an issue, refactor the @layer or @scope logic.

    Contextual Logic: Do not use "Architectural" properties (like margin, position: absolute, or grid-area) inside a component's base definition. These should be applied by the layout or parent container to maintain the component's autonomy.

    Property Grouping: Organize properties by Impact:

        Layout (Display, Flex, Grid, Position)

        Box Model (Width, Height, Margin, Padding)

        Typography (Font, Line-height, Letter-spacing)

        Visuals (Background, Border, Shadow)

        Misc (Transition, Opacity)

Implementation Template

When building a new feature, use this structure:
CSS

@layer components {
  @scope (.pk-component) {
    :scope {
      /* 1. Use system tokens */
      background: var(--bg-primary);
      padding: var(--space-md);
      
      /* 2. Logic-based layouts */
      display: grid;
      gap: var(--component-gap, 1rem);
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    }

    img {
      /* 3. Scoped child styles */
      border-radius: var(--radius-sm);
    }
  }
}
