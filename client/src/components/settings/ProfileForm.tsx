import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { insertProfileSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useUpdateProfile } from "@/hooks/use-supabase";
import { tallInputClass } from "@/lib/field-styles";

const profileFormSchema = insertProfileSchema.pick({ full_name: true });

export function ProfileForm({ fullName }: { fullName: string | null | undefined }) {
  const updateProfile = useUpdateProfile();
  const form = useForm({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { full_name: fullName || "" },
  });

  // The profile may load after the first render: fill the field once it arrives.
  useEffect(() => {
    if (!form.formState.isDirty) form.reset({ full_name: fullName || "" });
  }, [fullName, form]);

  const onSubmit = (data: { full_name?: string | null }) => {
    const full_name = data.full_name || "";
    updateProfile.mutate({ full_name }, { onSuccess: () => form.reset({ full_name }) });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="text-sm font-medium text-foreground/90">Nom complet</FormLabel>
              <FormControl>
                <Input placeholder="Jean Dupont" {...field} value={field.value ?? ""} className={tallInputClass} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            className="h-11 w-full rounded-[12px] px-5 text-base sm:w-auto"
            disabled={updateProfile.isPending || !form.formState.isDirty}
          >
            {updateProfile.isPending && <Loader2 className="animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </form>
    </Form>
  );
}
