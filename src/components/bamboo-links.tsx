import { Badge } from "@/components/ui/badge";
import type { BambooProduct } from "@/lib/bamboo-manifest";
import { bambooPlanUrl } from "@/lib/bamboo-manifest";

export function BambooLinks({ products }: { products: BambooProduct[] }) {
  if (products.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {products.map((product, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground font-medium">
            {product.display_name}
          </span>
          <Badge variant="outline" className="text-xs">
            {product.family}
          </Badge>
          {product.ua_branch && (
            <span className="text-xs text-green-600 dark:text-green-400 font-mono">
              {product.ua_branch}
            </span>
          )}
          <span className="flex flex-wrap gap-1.5">
            {Object.entries(product.plans).map(([planType, plan]) => (
              <a
                key={planType}
                href={bambooPlanUrl(plan)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/50 px-2 py-0.5 text-xs hover:bg-accent transition-colors"
              >
                {planType}
                <span className="text-muted-foreground">
                  {plan.project_key}-{plan.plan_key}
                </span>
              </a>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
