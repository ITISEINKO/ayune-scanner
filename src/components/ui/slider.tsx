"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "cn";

function Slider({ className, value, defaultValue, "aria-label": label, ...props }: SliderPrimitive.Root.Props<number>) {
	return (
		<SliderPrimitive.Root data-slot="slider" className={cn("w-full", className)} value={value} defaultValue={defaultValue} {...props}>
			<SliderPrimitive.Control className="relative flex h-10 w-full touch-none select-none items-center">
				<SliderPrimitive.Track data-slot="slider-track" className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
					<SliderPrimitive.Indicator data-slot="slider-range" className="h-full bg-primary" />
				</SliderPrimitive.Track>
				<SliderPrimitive.Thumb data-slot="slider-thumb" getAriaLabel={label ? () => label : undefined} className="block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
			</SliderPrimitive.Control>
		</SliderPrimitive.Root>
	);
}

export { Slider };
