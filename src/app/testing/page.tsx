import StagePicker from "@/components/stagePicker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { InfoIcon, Triangle } from "lucide-react";
import React from "react";

const UItesting = () => {
	return (
		<div className="container mx-auto">
			<div className="flex items-center justify-center  gap-2 p-10">
				<Badge variant="secondary">Packing</Badge>
				<span aria-hidden="true">→</span>
				<Badge>Delivery</Badge>
			</div>
			<Alert variant="destructive">
				<InfoIcon className="size-4" />
				<AlertTitle>Error</AlertTitle>
				<AlertDescription>
					There was a problem with your request.
				</AlertDescription>
			</Alert>
			<Alert variant="warning">
				<Triangle className="size-4" />
				<AlertTitle>Error</AlertTitle>
				<AlertDescription>
					There was a problem with your request.
				</AlertDescription>
			</Alert>

			<StagePicker currentStage={1} />
		</div>
	);
};

export default UItesting;
