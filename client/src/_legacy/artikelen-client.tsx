"use client";

import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  catalogCategoryLabels,
  type CatalogCategory,
} from "@/lib/catalog";
import { useOperoStore } from "@/lib/store";

const CATEGORIES: CatalogCategory[] = [
  "isolatie",
  "materiaal",
  "arbeid",
  "logistiek",
];

export function ArtikelenClient() {
  const articles = useOperoStore((state) => state.articles);
  const addArticle = useOperoStore((state) => state.addArticle);
  const updateArticle = useOperoStore((state) => state.updateArticle);
  const removeArticle = useOperoStore((state) => state.removeArticle);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Artikelen</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Beheer de artikelen en producten die je in offertes kiest.
            </p>
          </div>
          <Button
            onClick={() => {
              addArticle({
                category: "materiaal",
                name: "Nieuw artikel",
                unit: "stuks",
                unitPrice: 0,
                defaultQuantity: 1,
              });
              toast.success("Artikel toegevoegd");
            }}
            size="sm"
          >
            <Plus className="size-4" />
            Nieuw artikel
          </Button>
        </div>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead className="w-40">Categorie</TableHead>
                  <TableHead className="w-24">Eenheid</TableHead>
                  <TableHead className="w-28">Prijs</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell>
                      <Input
                        defaultValue={article.name}
                        onBlur={(event) =>
                          updateArticle(article.id, { name: event.target.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        onChange={(event) =>
                          updateArticle(article.id, {
                            category: event.target.value as CatalogCategory,
                          })
                        }
                        value={article.category}
                      >
                        {CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {catalogCategoryLabels[category]}
                          </option>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={article.unit}
                        onBlur={(event) =>
                          updateArticle(article.id, { unit: event.target.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={article.unitPrice}
                        key={`p-${article.unitPrice}`}
                        min={0}
                        onBlur={(event) =>
                          updateArticle(article.id, {
                            unitPrice: Number(event.target.value) || 0,
                          })
                        }
                        type="number"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        aria-label="Artikel verwijderen"
                        onClick={() => removeArticle(article.id)}
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 className="size-4 text-zinc-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {articles.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="text-center text-sm text-zinc-500"
                      colSpan={5}
                    >
                      Nog geen artikelen.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
