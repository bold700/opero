"use client";

import * as React from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const Form = FormProvider;

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return <Controller {...props} />;
}

function FormItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-2", className)} data-slot="form-item" {...props} />;
}

function FormLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Label>) {
  return <Label className={cn(className)} data-slot="form-label" {...props} />;
}

function FormControl({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function FormMessage({
  className,
  name,
}: {
  className?: string;
  name: string;
}) {
  const {
    formState: { errors },
  } = useFormContext();
  const error = errors[name];

  if (!error?.message) return null;

  return (
    <p className={cn("text-sm font-medium text-red-600", className)} data-slot="form-message">
      {String(error.message)}
    </p>
  );
}

export { Form, FormControl, FormField, FormItem, FormLabel, FormMessage };
