"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
	CircleCheckIcon,
	InfoIcon,
	TriangleAlertIcon,
	OctagonXIcon,
	Loader2Icon,
	CircleX,
} from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			theme="light"
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
				error: <CircleX className="size-4" />,
				loading: <Loader2Icon className="size-4 animate-spin" />,
			}}
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
          "--border-radius": "1rem",
					fontFamily: "var(--font-plus-jakarta-sans)",
				} as React.CSSProperties
			}
			toastOptions={{
				classNames: {
					toast: "border-border bg-popover text-popover-foreground shadow-lg",
					description: "!text-muted-foreground",
					actionButton: "!bg-primary !text-primary-foreground",
					cancelButton: "!bg-muted !text-muted-foreground",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };
