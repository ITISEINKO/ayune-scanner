import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LoginForm({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader className="text-center">
					<CardTitle className="text-xl">Welcome back</CardTitle>
					<CardDescription>Login with your Clickup account</CardDescription>
				</CardHeader>
				<CardContent>
					<form>
						<FieldGroup>
							<Field>
								<Button variant="outline" type="button">
									<img src="/clickup.svg" alt="" className="size-4" />
									Login with ClickUp
								</Button>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
