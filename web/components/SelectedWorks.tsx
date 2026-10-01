"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Section } from "./Section";

const works = [
  {
    title: "Fintech Brand System",
    category: "Design Systems & Token Architecture",
    image: "linear-gradient(135deg, #1A1D24 0%, #0B0F14 100%)", // placeholder for real images
    stats: "3x Conversion Rate",
  },
  {
    title: "SaaS Growth Playbook",
    category: "Content & Go-to-locale",
    image: "linear-gradient(135deg, #151B24 0%, #05080A 100%)",
    stats: "+120% Inbound Leads",
  },
  {
    title: "Web3 Protocol Launch",
    category: "Brand Strategy & Visual Identity",
    image: "linear-gradient(135deg, #2A303C 0%, #151B24 100%)",
    stats: "$40M TVL in 30 days",
  }
];

export function SelectedWorks() {
  return (
    <Section id="work" eyebrow="Selected Works" title="Systems in Action">
      <div className="flex flex-col gap-12 mt-8">
        {works.map((work, idx) => (
          <motion.div
            key={work.title}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: idx * 0.1 }}
            className="group relative cursor-pointer block"
          >
            {/* Image / Background Container */}
            <div 
              className="relative w-full aspect-[16/9] md:aspect-[21/9] rounded-2xl overflow-hidden bg-rhymvex-slate/50 border border-rhymvex-white/10 transition-colors duration-500 group-hover:border-rhymvex-volt/40"
              style={{ background: work.image }}
            >
              <div className="absolute inset-0 bg-rhymvex-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              {/* Subtle grid overlay to keep with the brand vibe */}
              <div className="rv-grid pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
              
              {/* Floating Arrow on Hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 ease-out">
                <div className="flex size-20 items-center justify-center rounded-full bg-rhymvex-volt text-rhymvex-black backdrop-blur-md">
                  <ArrowUpRight className="size-8" />
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="mt-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h3 className="text-2xl md:text-3xl font-display font-semibold text-rhymvex-white group-hover:text-rhymvex-volt transition-colors duration-300">
                  {work.title}
                </h3>
                <p className="mt-2 text-rhymvex-white/60">
                  {work.category}
                </p>
              </div>
              <div className="flex items-center">
                <span className="inline-flex items-center px-3 py-1 rounded-full border border-rhymvex-white/10 bg-rhymvex-white/5 text-sm font-medium text-rhymvex-white/80 group-hover:border-rhymvex-volt/30 group-hover:bg-rhymvex-volt/10 group-hover:text-rhymvex-volt transition-colors duration-300">
                  {work.stats}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
