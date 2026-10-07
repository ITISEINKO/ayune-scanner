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
	error,
	...props
}: React.ComponentProps<"div"> & { error?: string }) {
	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card className="border-primary/10 shadow-xl shadow-primary/10">
				<CardHeader className="text-center">
					<CardTitle className="text-xl">Welcome back</CardTitle>
					<CardDescription>Login with your Clickup account</CardDescription>
				</CardHeader>
				<CardContent>
					{error === "unauthorized" && (
						<p
							role="alert"
							className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
						>
							Akun ClickUp ini tidak memiliki akses ke Produksi.
						</p>
					)}
					<form>
						<FieldGroup>
							<Field>
								<Button
									nativeButton={false}
									render={<a href="/api/auth/clickup" />}
									className="shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5"
								>
									<img src="/clickup.svg" alt="" className="size-4 brightness-0 invert" />
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
