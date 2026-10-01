import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "secondary" | "danger";
};

export function Button({
	className = "",
	variant = "primary",
	...props
}: Props) {
	const colors = {
		primary: "bg-primary text-primary-foreground hover:bg-primary/90",
		secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
		danger:
			"bg-destructive text-destructive-foreground hover:bg-destructive/90",
	};
	return (
		<button
			className={`min-h-12 rounded-xl px-4 font-bold transition disabled:cursor-not-allowed disabled:bg-accent disabled:text-accent-foreground/40 ${colors[variant]} ${className}`}
			{...props}
		/>
	);
}
