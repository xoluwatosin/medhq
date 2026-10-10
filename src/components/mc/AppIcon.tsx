// A line icon from the Workforce and Client app set. It takes the colour of the
// text around it. Decorative by default (the label sits beside it); pass
// `label` when the icon stands alone.
import { APP_ICON_PATHS, type AppIconName } from "./app-icon-paths";

export const AppIcon = ({ name, size = 20, label, className }: {
  name: AppIconName;
  size?: 20 | 24;
  label?: string;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="square"
    strokeLinejoin="miter"
    strokeMiterlimit={2.5}
    className={className}
    {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
  >
    <path d={APP_ICON_PATHS[name]} />
  </svg>
);

export default AppIcon;
