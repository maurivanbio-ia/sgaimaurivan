# -*- coding: utf-8 -*-
"""
Biodiversidade. Script de análises automáticas para planilhas de fauna (registros por ocorrência).

Versão FINAL (tabela tipo “Tabela 17” e gráfico por metodologia incluídos):
. Dois recortes: 17–22 e 5–22
. Remove "Encontro ocasional" antes de qualquer análise (em METODO e/ou MODO DE REGISTRO, se existirem)
. TODOS os gráficos trazem no título:
  . cenário (C17_22 ou C05_22)
  . intervalo alvo (ex: 17–22)
  . campanhas efetivamente presentes após filtros (min–max e lista)
. Gera gráfico de frequência relativa das espécies registradas (TopN + OUTRAS) por cenário
  . Corrige KeyError 'ESPECIE' e TypeError do matplotlib no eixo X
. NOVO. Gera tabela “tipo Tabela 17” por cenário:
  . metadados por espécie (Ordem, Família, Nome comum, Método, Dieta, Endemismo, status)
  . colunas por Unidade Amostral (UA1..UAn conforme existir)
  . Abundância geral e Frequência relativa (%)
. NOVO. Gera gráfico “Abundância e Riqueza por Metodologia” por cenário
  . barras. abundância (n de registros)
  . linha. riqueza (n de espécies)
. Exporta:
  . Excel por cenário (inclui Tabela_Especies_UA e Abund_Riq_por_Metodo)
  . PNGs por cenário
  . Matrizes (contagens e incidência) por cenário
  . Dados brutos usados por cenário
  . Comparativo C17_22 vs C05_22

Requisitos.
Python 3.10+ (por causa de anotações do tipo str | None). Ajuste para Optional se necessário.
"""

import os
import re
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from scipy.spatial.distance import pdist
from scipy.cluster.hierarchy import linkage, dendrogram

# =========================
# CONFIGURAÇÕES
# =========================
INPUT_FILES = [
    os.path.join(os.path.dirname(__file__), "BD_Quiroptero_CE Umburanas 5ª à 22ª Campanha OK.xlsx"),
    os.path.join(os.path.dirname(__file__), "BD Mastofauna_CE Umburanas 5ª à 22ª Camp_OK.xlsx"),
]

OUTDIR = os.path.join(os.path.dirname(__file__), "RESULTADOS_DIVERSIDADE_UMBURANAS")
N_PERM_ACCUM = 300
MAX_STEPS = 50
DPI = 350

SCENARIOS = [
    {"tag": "C17_22", "title": "Campanhas 17–22", "min": 17, "max": 22},
    {"tag": "C05_22", "title": "Campanhas 5–22", "min": 5, "max": 22},
]

# Frequência relativa das espécies
REL_FREQ_TOPN = 20  # Top N espécies. resto vira "OUTRAS"

REQUESTED_VARIABLES = [
    "ID", "GRUPO TAXONOMICO", "GRUPOS", "COMPLEXO", "PARQUE", "CAMPANHA", "DATA", "HORARIO", "SAZONALIDADE",
    "UNIDADE AMOSTRAL", "ZONA UTM", "LATITUDE", "LATITUTE", "LONGITUDE", "FILO", "CLASSE", "ORDEM", "FAMILIA",
    "ESPECIE", "NOME COMUM", "SEXO", "IDADE", "METODO", "MODO DE REGISTRO", "DESCRICAO DO ESFORCO",
    "DURACAO DA AMOSTRAGEM", "DISTANCIA PERCORRIDA", "STATUS DO REGISTRO", "CONDICAO METEOROLOGICA",
    "AMBIENTE PREFERENCIAL", "ESTAGIO REPRODUTIVO", "DISTRIBUICAO", "DIETA", "HABITAT", "ENDEMISMO",
    "FITOFISIONOMIA", "IUCN", "IBAMA/MMA", "CITES", "SEMA/BA", "PAN", "USO DO HABITAT", "SENSIBILIDADE",
    "LOCOMOCAO", "BIOINDICADOR", "PESO (G)", "TIPO DA MARCACAO", "NUMERO DA MARCACAO", "NUMERO DE TOMBAMENTO",
    "INSTITUICAO DE TOMBAMENTO", "NOME DO COLETOR", "OBSERVACAO", "CRC (MM)", "CCA (MM)", "LCA (MM)",
    "UM (MM)", "RA (MM)", "FE (MM)", "TI (MM)", "TA (MM)", "DO (MM)", "LO (MM)", "CT (MM)", "CC (MM)",
]

# =========================
# UTILITÁRIOS
# =========================
def _norm(s: str) -> str:
    if s is None:
        return ""
    s = str(s).strip().upper()
    s = re.sub(r"\s+", " ", s)
    trans = str.maketrans(
        "ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ",
        "AAAAAEEEEIIIIOOOOOUUUUC"
    )
    s = s.translate(trans)
    return s

def norm_value(v) -> str:
    if pd.isna(v):
        return ""
    s = str(v).strip().upper()
    s = _norm(s)
    s = s.replace("_", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s

def find_col(df: pd.DataFrame, candidates):
    cols_norm = {_norm(c): c for c in df.columns}
    for cand in candidates:
        cn = _norm(cand)
        if cn in cols_norm:
            return cols_norm[cn]
    for cand in candidates:
        cn = _norm(cand)
        for k_norm, original in cols_norm.items():
            if cn in k_norm:
                return original
    return None

def find_all_cols(df: pd.DataFrame, candidate):
    cn = _norm(candidate)
    out = []
    for c in df.columns:
        k = _norm(c)
        if k == cn or cn in k:
            out.append(c)
    return out

def pick_existing_columns(df: pd.DataFrame, desired_names):
    keep = []
    used = set()
    for name in desired_names:
        matches = find_all_cols(df, name)
        for m in matches:
            if m not in used:
                keep.append(m)
                used.add(m)
    return keep

def parse_campaign_number(x):
    if pd.isna(x):
        return np.nan
    s = str(x).strip()
    m = re.search(r"(\d+)", s)
    if not m:
        return np.nan
    try:
        return int(m.group(1))
    except Exception:
        return np.nan

def safe_species_name(x):
    if pd.isna(x):
        return np.nan
    s = str(x).strip().upper()
    s = re.sub(r"\s+", " ", s)
    return s if s != "" else np.nan

def safe_family_name(x):
    if pd.isna(x):
        return np.nan
    s = str(x).strip().upper()
    s = re.sub(r"\s+", " ", s)
    return s if s != "" else np.nan

def shannon(counts):
    counts = np.asarray(counts, dtype=float)
    counts = counts[counts > 0]
    if counts.size == 0:
        return np.nan
    p = counts / counts.sum()
    return -np.sum(p * np.log(p))

def simpson_1_minus_D(counts):
    counts = np.asarray(counts, dtype=float)
    counts = counts[counts > 0]
    if counts.size == 0:
        return np.nan
    p = counts / counts.sum()
    D = np.sum(p ** 2)
    return 1.0 - D

def pielou(counts):
    H = shannon(counts)
    S = np.sum(np.asarray(counts) > 0)
    if S <= 1 or np.isnan(H):
        return np.nan
    return H / np.log(S)

def jackknife1_incidence(incidence_matrix: pd.DataFrame):
    n = incidence_matrix.shape[0]
    if n == 0:
        return np.nan
    Sobs = int((incidence_matrix.sum(axis=0) > 0).sum())
    Qi1 = int((incidence_matrix.sum(axis=0) == 1).sum())
    return Sobs + Qi1 * (n - 1) / n

def bootstrap_incidence(incidence_matrix: pd.DataFrame):
    n = incidence_matrix.shape[0]
    if n == 0:
        return np.nan
    freq = incidence_matrix.sum(axis=0).astype(float)
    present = freq[freq > 0]
    Sobs = int(present.shape[0])
    p = present / n
    return Sobs + float(np.sum((1 - p) ** n))

def species_accumulation_curves(sample_by_species_counts: pd.DataFrame,
                                n_perm=300,
                                max_steps=50,
                                random_seed=42):
    rng = np.random.default_rng(random_seed)
    inc = (sample_by_species_counts > 0).astype(int)

    n_samples = inc.shape[0]
    if n_samples == 0:
        return None

    steps = np.unique(
        np.round(np.linspace(1, n_samples, num=min(max_steps, n_samples))).astype(int)
    )

    sobs_all = np.zeros((n_perm, len(steps)), dtype=float)
    jack_all = np.zeros((n_perm, len(steps)), dtype=float)
    boot_all = np.zeros((n_perm, len(steps)), dtype=float)

    sample_idx = np.arange(n_samples)

    for p in range(n_perm):
        perm = rng.permutation(sample_idx)
        for j, k in enumerate(steps):
            subset = inc.iloc[perm[:k], :]
            sobs_all[p, j] = float((subset.sum(axis=0) > 0).sum())
            jack_all[p, j] = float(jackknife1_incidence(subset))
            boot_all[p, j] = float(bootstrap_incidence(subset))

    def summarize(mat):
        return {
            "mean": mat.mean(axis=0),
            "sd": mat.std(axis=0, ddof=1) if mat.shape[0] > 1 else np.zeros(mat.shape[1]),
            "p025": np.quantile(mat, 0.025, axis=0),
            "p975": np.quantile(mat, 0.975, axis=0),
        }

    return {
        "steps": steps,
        "Sobs": summarize(sobs_all),
        "Jackknife1": summarize(jack_all),
        "Bootstrap": summarize(boot_all),
    }

def threatened_flag_row(row, iucn_col=None, ibama_col=None, sema_col=None):
    threatened_cats = {"VU", "EN", "CR", "EW", "EX"}

    iucn = None
    if iucn_col and iucn_col in row and pd.notna(row[iucn_col]):
        iucn = str(row[iucn_col]).strip().upper().replace(" ", "")

    is_iucn_thr = (iucn in threatened_cats)

    nat_thr = False
    for c in [ibama_col, sema_col]:
        if c and c in row and pd.notna(row[c]) and str(row[c]).strip() != "":
            nat_thr = True

    return bool(is_iucn_thr or nat_thr)

def drop_encontro_ocasional(df: pd.DataFrame, col_modo: str | None, col_metodo: str | None):
    alvo = "ENCONTRO OCASIONAL"
    if col_modo is None and col_metodo is None:
        return df

    mask_keep = pd.Series(True, index=df.index)

    if col_modo is not None and col_modo in df.columns:
        modo_norm = df[col_modo].apply(norm_value)
        mask_keep &= ~modo_norm.str.contains(alvo, na=False)

    if col_metodo is not None and col_metodo in df.columns:
        met_norm = df[col_metodo].apply(norm_value)
        mask_keep &= ~met_norm.str.contains(alvo, na=False)

    return df.loc[mask_keep].copy()

def scenario_campaign_label(campaigns_present, sc_min, sc_max, tag):
    cps = sorted({int(x) for x in campaigns_present if pd.notna(x)})
    if len(cps) == 0:
        return f"{tag} alvo {sc_min}–{sc_max}. campanhas presentes: nenhuma"
    cps_str = ",".join(str(x) for x in cps)
    return f"{tag} alvo {sc_min}–{sc_max}. presentes {min(cps)}–{max(cps)}. lista [{cps_str}]"

# =========================
# FREQUÊNCIA RELATIVA DAS ESPÉCIES
# =========================
def relative_frequency_table(df: pd.DataFrame, topN: int = 20) -> pd.DataFrame:
    """
    Retorna tabela com frequência absoluta e relativa (proporção e %).
    Inclui agregação "OUTRAS" para além do TopN.
    Saída garante colunas: ESPECIE, Frequencia_abs, Frequencia_rel, Frequencia_rel_pct
    """
    if df is None or df.shape[0] == 0 or "_ESPECIE" not in df.columns:
        return pd.DataFrame(columns=["ESPECIE", "Frequencia_abs", "Frequencia_rel", "Frequencia_rel_pct"])

    vc = df["_ESPECIE"].dropna().astype(str).value_counts()
    if vc.shape[0] == 0:
        return pd.DataFrame(columns=["ESPECIE", "Frequencia_abs", "Frequencia_rel", "Frequencia_rel_pct"])

    counts = vc.rename("Frequencia_abs").to_frame()
    total = float(counts["Frequencia_abs"].sum())
    counts["Frequencia_rel"] = counts["Frequencia_abs"] / total
    counts["Frequencia_rel_pct"] = 100.0 * counts["Frequencia_rel"]

    counts = counts.reset_index()
    counts = counts.rename(columns={counts.columns[0]: "ESPECIE"})
    counts["ESPECIE"] = counts["ESPECIE"].astype(str).fillna("")

    top = counts.head(topN).copy()
    rest = counts.iloc[topN:].copy()

    if rest.shape[0] > 0:
        outras = pd.DataFrame([{
            "ESPECIE": "OUTRAS",
            "Frequencia_abs": float(rest["Frequencia_abs"].sum()),
            "Frequencia_rel": float(rest["Frequencia_rel"].sum()),
            "Frequencia_rel_pct": float(rest["Frequencia_rel_pct"].sum()),
        }])
        out = pd.concat([top, outras], ignore_index=True)
    else:
        out = top

    out["Frequencia_abs"] = pd.to_numeric(out["Frequencia_abs"], errors="coerce").fillna(0)
    out["Frequencia_rel"] = pd.to_numeric(out["Frequencia_rel"], errors="coerce").fillna(0)
    out["Frequencia_rel_pct"] = pd.to_numeric(out["Frequencia_rel_pct"], errors="coerce").fillna(0)

    return out

def plot_relative_frequency(df_rf: pd.DataFrame,
                            base: str,
                            scenario_title: str,
                            title_label: str,
                            out_base: str,
                            scenario_tag: str,
                            rel_topn: int):
    """
    Plota barras com frequência relativa (%) por espécie (TopN + OUTRAS).
    Evita KeyError de coluna e TypeError no eixo X.
    """
    if df_rf is None or df_rf.shape[0] == 0:
        return

    df_plot = df_rf.copy()

    if "ESPECIE" not in df_plot.columns:
        if "ESPÉCIE" in df_plot.columns:
            df_plot = df_plot.rename(columns={"ESPÉCIE": "ESPECIE"})
        else:
            first_col = df_plot.columns[0]
            if first_col not in {"Frequencia_abs", "Frequencia_rel", "Frequencia_rel_pct"}:
                df_plot = df_plot.rename(columns={first_col: "ESPECIE"})
            else:
                return

    x = df_plot["ESPECIE"].astype(str).fillna("N/D").values

    if "Frequencia_rel_pct" in df_plot.columns:
        y = pd.to_numeric(df_plot["Frequencia_rel_pct"], errors="coerce").fillna(0.0).values
    elif "Frequencia_rel" in df_plot.columns:
        y = 100.0 * pd.to_numeric(df_plot["Frequencia_rel"], errors="coerce").fillna(0.0).values
    else:
        return

    plt.figure(figsize=(12, 6))
    plt.bar(x, y.astype(float), color=(178/255, 205/255, 225/255))
    plt.xticks(rotation=70, ha="right")
    plt.ylabel("Frequência relativa (%)")
    plt.title(f"Frequência relativa das espécies registradas. {base}\n{scenario_title}. {title_label}")
    plt.tight_layout()
    plt.savefig(
        os.path.join(out_base, f"{base}__{scenario_tag}__frequencia_relativa_especies_top{rel_topn}.png"),
        dpi=DPI
    )
    plt.close()

# =========================
# ANÁLISE PARA UM DF JÁ FILTRADO
# =========================
def run_analysis_on_df(df: pd.DataFrame,
                       base: str,
                       out_base: str,
                       scenario_tag: str,
                       scenario_title: str,
                       sc_min: int,
                       sc_max: int,
                       col_campaign: str,
                       col_unit: str,
                       col_species: str,
                       col_family: str,
                       col_iucn: str | None,
                       col_ibama: str | None,
                       col_sema: str | None,
                       col_metodo: str | None = None,
                       col_nome_comum: str | None = None,
                       col_dieta: str | None = None,
                       col_endemismo: str | None = None,
                       col_ordem: str | None = None,
                       col_cites: str | None = None,
                       col_modo_reg: str | None = None,
                       col_metodo_filtro: str | None = None):

    # Cria subpastas para organização por cenário
    path_scenario = os.path.join(out_base, scenario_tag)
    path_graphs = os.path.join(path_scenario, "GRAFICOS")
    path_tables = os.path.join(path_scenario, "TABELAS")
    os.makedirs(path_graphs, exist_ok=True)
    os.makedirs(path_tables, exist_ok=True)

    df = df.copy()

    # Campos mínimos
    df["_CAMPANHA_RAW"] = df[col_campaign].fillna("").astype(str)
    df["_UA"] = df[col_unit].fillna("UA_DESCONHECIDA").astype(str)
    df["_ESPECIE"] = df[col_species].apply(safe_species_name)
    df["_FAMILIA"] = df[col_family].apply(safe_family_name)

    # Remove registros sem espécie
    df = df[df["_ESPECIE"].notna()].copy()

    # Campanha numérica. Filtra campanhas inválidas antes de qualquer astype(int)
    df["_CAMPANHA_NUM"] = df["_CAMPANHA_RAW"].apply(parse_campaign_number)
    df = df[df["_CAMPANHA_NUM"].notna()].copy()
    df["_CAMPANHA_NUM"] = df["_CAMPANHA_NUM"].astype(int)

    campaigns_present = df["_CAMPANHA_NUM"].dropna().astype(int).unique().tolist()
    title_label = scenario_campaign_label(campaigns_present, sc_min, sc_max, scenario_tag)

    df["_CAMPANHA"] = df["_CAMPANHA_NUM"].astype(int).astype(str)
    df["_SAMPLE"] = df["_CAMPANHA"].astype(str) + "_UA" + df["_UA"].astype(str)

    # Para análises estatísticas e gráficos de área, removemos Encontro Ocasional
    df_stats = drop_encontro_ocasional(df, col_modo_reg, col_metodo_filtro)

    # Campos opcionais de apoio à Tabela 17 e gráfico por metodologia
    def _series_or_nan(colname):
        if colname is not None and colname in df.columns:
            return df[colname]
        return np.nan

    if col_metodo is not None and col_metodo in df.columns:
        df["_METODO"] = df[col_metodo].apply(norm_value).replace("", np.nan)
    else:
        df["_METODO"] = np.nan

    df["_ORDEM"] = _series_or_nan(col_ordem)
    df["_NOME_COMUM"] = _series_or_nan(col_nome_comum)
    df["_DIETA"] = _series_or_nan(col_dieta)
    df["_ENDEMISMO"] = _series_or_nan(col_endemismo)
    df["_IUCN"] = _series_or_nan(col_iucn)
    df["_IBAMA_MMA"] = _series_or_nan(col_ibama)
    df["_SEMA_BA"] = _series_or_nan(col_sema)
    df["_CITES"] = _series_or_nan(col_cites)

    # =========================
    # TABELAS BÁSICAS
    # =========================
    richness_by_campaign = (
        df.groupby("_CAMPANHA")["_ESPECIE"]
        .nunique()
        .rename("Riqueza_Sobs")
        .to_frame()
    )
    abundance_by_campaign = (
        df.groupby("_CAMPANHA")["_ESPECIE"]
        .size()
        .rename("Abundancia_registros")
        .to_frame()
    )
    summary_campaign = richness_by_campaign.join(abundance_by_campaign).reset_index()
    summary_campaign["_CAMPANHA_NUM"] = summary_campaign["_CAMPANHA"].astype(int)
    summary_campaign = summary_campaign.sort_values("_CAMPANHA_NUM").drop(columns=["_CAMPANHA_NUM"])

    richness_by_ua = (
        df_stats.groupby("_UA")["_ESPECIE"]
        .nunique()
        .rename("Riqueza_Sobs")
        .to_frame()
    )
    abundance_by_ua = (
        df_stats.groupby("_UA")["_ESPECIE"]
        .size()
        .rename("Abundancia_registros")
        .to_frame()
    )
    summary_ua = richness_by_ua.join(abundance_by_ua).reset_index()

    fam_rich = df.groupby("_FAMILIA")["_ESPECIE"].nunique().rename("Riqueza_species").to_frame()
    fam_abun = df.groupby("_FAMILIA")["_ESPECIE"].size().rename("Abundancia_registros").to_frame()
    fam_summary = fam_rich.join(fam_abun).sort_values(
        ["Riqueza_species", "Abundancia_registros"], ascending=False
    ).reset_index().rename(columns={"_FAMILIA": "FAMILIA"})

    sp_top = (
        df.groupby("_ESPECIE")["_ESPECIE"].size()
        .rename("Registros")
        .sort_values(ascending=False)
        .reset_index()
        .rename(columns={"_ESPECIE": "ESPECIE"})
    )

    sp_by_ua = (
        df.groupby(["_UA", "_ESPECIE"])["_ESPECIE"].size()
        .rename("Registros")
        .reset_index()
        .rename(columns={"_ESPECIE": "ESPECIE"})
        .sort_values(["_UA", "Registros"], ascending=[True, False])
    )

    # =========================
    # FREQUÊNCIA RELATIVA DAS ESPÉCIES
    # =========================
    sp_relfreq = relative_frequency_table(df, topN=REL_FREQ_TOPN)
    plot_relative_frequency(
        df_rf=sp_relfreq,
        base=base,
        scenario_title=scenario_title,
        title_label=title_label,
        out_base=path_graphs,
        scenario_tag=scenario_tag,
        rel_topn=REL_FREQ_TOPN
    )

    # =========================
    # MATRIZES AMOSTRA x ESPÉCIE
    # =========================
    sample_species_counts = pd.crosstab(df_stats["_SAMPLE"], df_stats["_ESPECIE"])

    # Diversidade por amostra
    div_sample = []
    for sample_id, row_counts in sample_species_counts.iterrows():
        counts = row_counts.values
        div_sample.append({
            "SAMPLE": sample_id,
            "Riqueza_Sobs": int((counts > 0).sum()),
            "Abundancia_registros": int(counts.sum()),
            "Shannon_H": shannon(counts),
            "Simpson_1-D": simpson_1_minus_D(counts),
            "Pielou_J": pielou(counts),
        })
    div_sample = pd.DataFrame(div_sample)

    # Diversidade por campanha
    camp_species_counts = pd.crosstab(df_stats["_CAMPANHA"], df_stats["_ESPECIE"])
    div_campaign = []
    for camp, row_counts in camp_species_counts.iterrows():
        counts = row_counts.values
        div_campaign.append({
            "CAMPANHA": camp,
            "Riqueza_Sobs": int((counts > 0).sum()),
            "Abundancia_registros": int(counts.sum()),
            "Shannon_H": shannon(counts),
            "Simpson_1-D": simpson_1_minus_D(counts),
            "Pielou_J": pielou(counts),
        })
    div_campaign = pd.DataFrame(div_campaign)
    div_campaign["CAMPANHA_NUM"] = div_campaign["CAMPANHA"].astype(int)
    div_campaign = div_campaign.sort_values("CAMPANHA_NUM").drop(columns=["CAMPANHA_NUM"])

    # Diversidade por UA
    ua_species_counts = pd.crosstab(df_stats["_UA"], df_stats["_ESPECIE"])
    div_ua = []
    for ua, row_counts in ua_species_counts.iterrows():
        counts = row_counts.values
        div_ua.append({
            "UNIDADE_AMOSTRAL": ua,
            "Riqueza_Sobs": int((counts > 0).sum()),
            "Abundancia_registros": int(counts.sum()),
            "Shannon_H": shannon(counts),
            "Simpson_1-D": simpson_1_minus_D(counts),
            "Pielou_J": pielou(counts),
        })
    div_ua = pd.DataFrame(div_ua).sort_values("UNIDADE_AMOSTRAL")

    # =========================
    # CURVA DE ACUMULAÇÃO
    # =========================
    accum = species_accumulation_curves(
        sample_by_species_counts=sample_species_counts,
        n_perm=N_PERM_ACCUM,
        max_steps=MAX_STEPS,
        random_seed=123
    )

    if accum is not None:
        steps = accum["steps"]

        plt.figure(figsize=(9, 6))
        sobs_color = (178/255, 205/255, 225/255)

        plt.plot(steps, accum["Sobs"]["mean"], label="Observada (Sobs)", color=sobs_color)
        plt.fill_between(steps, accum["Sobs"]["p025"], accum["Sobs"]["p975"], alpha=0.2, color=sobs_color)

        plt.plot(steps, accum["Jackknife1"]["mean"], label="Jackknife 1 (incidência)", color="tab:blue")
        plt.fill_between(steps, accum["Jackknife1"]["p025"], accum["Jackknife1"]["p975"], alpha=0.2, color="tab:blue")

        plt.plot(steps, accum["Bootstrap"]["mean"], label="Bootstrap (incidência)", color="darkblue")
        plt.fill_between(steps, accum["Bootstrap"]["p025"], accum["Bootstrap"]["p975"], alpha=0.2, color="darkblue")

        plt.xlabel("Número de amostras (Campanha×UA)")
        plt.ylabel("Riqueza de espécies")
        plt.title(f"Curva de acumulação. {base}\n{scenario_title}. {title_label}")
        plt.legend()
        plt.tight_layout()
        plt.savefig(os.path.join(path_graphs, f"{base}__{scenario_tag}__curva_acumulacao.png"), dpi=DPI)
        plt.close()

        accum_table = pd.DataFrame({
            "n_amostras": steps,
            "Sobs_mean": accum["Sobs"]["mean"],
            "Sobs_p025": accum["Sobs"]["p025"],
            "Sobs_p975": accum["Sobs"]["p975"],
            "Jack1_mean": accum["Jackknife1"]["mean"],
            "Jack1_p025": accum["Jackknife1"]["p025"],
            "Jack1_p975": accum["Jackknife1"]["p975"],
            "Boot_mean": accum["Bootstrap"]["mean"],
            "Boot_p025": accum["Bootstrap"]["p025"],
            "Boot_p975": accum["Bootstrap"]["p975"],
        })
    else:
        accum_table = pd.DataFrame()

    # =========================
    # DENDROGRAMA BRAY CURTIS POR UA
    # =========================
    if ua_species_counts.shape[0] >= 2:
        dist = pdist(ua_species_counts.values, metric="braycurtis")
        Z = linkage(dist, method="average")

        plt.figure(figsize=(12, 6))
        dendrogram(Z, labels=ua_species_counts.index.tolist(), leaf_rotation=90)
        plt.title(f"Dendrograma Bray Curtis (UPGMA) por Área. {base}\n{scenario_title}. {title_label}")
        plt.ylabel("Distância (Bray Curtis)")
        plt.tight_layout()
        plt.savefig(os.path.join(path_graphs, f"{base}__{scenario_tag}__dendrograma_braycurtis_por_area.png"), dpi=DPI)
        plt.close()

    # =========================
    # ESPÉCIES AMEAÇADAS
    # =========================
    if col_iucn is not None or col_ibama is not None or col_sema is not None:
        df_th = df.copy()
        keep_cols = ["_ESPECIE", "_FAMILIA"]
        for c in [col_iucn, col_ibama, col_sema]:
            if c is not None and c in df.columns:
                keep_cols.append(c)

        df_th = df_th[keep_cols].drop_duplicates()

        df_th["AMEACADA_FLAG"] = df_th.apply(
            threatened_flag_row,
            axis=1,
            iucn_col=col_iucn,
            ibama_col=col_ibama,
            sema_col=col_sema
        )

        threatened_species = (
            df_th[df_th["AMEACADA_FLAG"]]
            .rename(columns={"_ESPECIE": "ESPECIE", "_FAMILIA": "FAMILIA"})
            .sort_values(["FAMILIA", "ESPECIE"])
            .reset_index(drop=True)
        )
    else:
        threatened_species = pd.DataFrame()

    # =========================
    # ESPÉCIES ENDÊMICAS
    # =========================
    if col_endemismo is not None and col_endemismo in df.columns:
        df_end = df.copy()
        def is_endemic(val):
            v = norm_value(val)
            return v != "" and v not in ["NAO", "N", "0", "FALSE"]
        
        df_end["ENDEMICA_FLAG"] = df_end[col_endemismo].apply(is_endemic)
        endemic_species = (
            df_end[df_end["ENDEMICA_FLAG"]][["_ESPECIE", "_FAMILIA", col_endemismo]]
            .drop_duplicates()
            .rename(columns={"_ESPECIE": "ESPECIE", "_FAMILIA": "FAMILIA"})
            .sort_values(["FAMILIA", "ESPECIE"])
            .reset_index(drop=True)
        )
    else:
        endemic_species = pd.DataFrame()

    # =========================
    # GRÁFICOS EXTRAS
    # =========================
    topN = 15
    fam_top_abun = fam_summary.sort_values("Abundancia_registros", ascending=False).head(topN)

    def barplot(df_plot, xcol, ycol, title, outname, ylabel=None):
        if df_plot is None or df_plot.shape[0] == 0:
            return
        plt.figure(figsize=(10, 6))
        plt.bar(df_plot[xcol].astype(str), df_plot[ycol].astype(float), color=(178/255, 205/255, 225/255))
        plt.xticks(rotation=70, ha="right")
        plt.title(title)
        plt.ylabel(ylabel if ylabel else ycol)
        plt.tight_layout()
        plt.savefig(os.path.join(path_graphs, outname), dpi=DPI)
        plt.close()

    # Gráfico combinado de Abundância e Riqueza por Família
    if not fam_top_abun.empty:
        fig, ax1 = plt.subplots(figsize=(12, 6))
        x_fam = fam_top_abun["FAMILIA"].astype(str).values
        y_ab_fam = fam_top_abun["Abundancia_registros"].astype(float).values
        y_riq_fam = fam_top_abun["Riqueza_species"].astype(float).values

        ax1.bar(x_fam, y_ab_fam, label="Abundância (registros)", alpha=0.7, color=(178/255, 205/255, 225/255))
        ax1.set_ylabel("Abundância (registros)", color=(178/255, 205/255, 225/255))
        ax1.tick_params(axis='y', labelcolor=(178/255, 205/255, 225/255))
        ax1.set_xticks(range(len(x_fam)))
        ax1.set_xticklabels(x_fam, rotation=70, ha="right")

        ax2 = ax1.twinx()
        ax2.plot(x_fam, y_riq_fam, marker="o", linewidth=2, label="Riqueza (espécies)", color="tab:red")
        ax2.set_ylabel("Riqueza (espécies)", color="tab:red")
        ax2.tick_params(axis='y', labelcolor="tab:red")

        plt.title(f"Abundância e Riqueza por Família (Top {topN}). {base}\n{scenario_title}. {title_label}")
        h1, l1 = ax1.get_legend_handles_labels()
        h2, l2 = ax2.get_legend_handles_labels()
        ax1.legend(h1+h2, l1+l2, loc='upper right')
        fig.tight_layout()
        plt.savefig(os.path.join(path_graphs, f"{base}__{scenario_tag}__familias_top_abund_riqueza.png"), dpi=DPI)
        plt.close()

    sp_topN = sp_top.head(20)
    barplot(
        sp_topN, "ESPECIE", "Registros",
        f"Espécies mais registradas (Top 20). {base}\n{scenario_title}. {title_label}",
        f"{base}__{scenario_tag}__especies_top20_registros.png",
        ylabel="Número de registros"
    )

    fig, ax1 = plt.subplots(figsize=(10, 6))
    x_c = summary_campaign["_CAMPANHA"].astype(str).values
    y_riq_c = summary_campaign["Riqueza_Sobs"].astype(float).values
    y_ab_c = summary_campaign["Abundancia_registros"].astype(float).values

    ax1.bar(x_c, y_ab_c, label="Abundância (registros)", alpha=0.7, color=(178/255, 205/255, 225/255))
    ax1.set_ylabel("Abundância (registros)", color=(178/255, 205/255, 225/255))
    ax1.tick_params(axis='y', labelcolor=(178/255, 205/255, 225/255))
    ax1.set_xlabel("Campanha")

    ax2 = ax1.twinx()
    ax2.plot(x_c, y_riq_c, marker="o", linewidth=2, label="Riqueza (Sobs)", color="tab:red")
    ax2.set_ylabel("Riqueza (Sobs)", color="tab:red")
    ax2.tick_params(axis='y', labelcolor="tab:red")

    plt.title(f"Riqueza e abundância por campanha. {base}\n{scenario_title}. {title_label}")
    h1, l1 = ax1.get_legend_handles_labels()
    h2, l2 = ax2.get_legend_handles_labels()
    ax1.legend(h1+h2, l1+l2, loc='upper left')
    fig.tight_layout()
    plt.savefig(os.path.join(path_graphs, f"{base}__{scenario_tag}__riqueza_abundancia_por_campanha.png"), dpi=DPI)
    plt.close()

    # =========================
    # NOVO. TABELA TIPO “TABELA 17”. ESPÉCIE x UA + METADADOS + STATUS
    # =========================
    sp_ua_counts = pd.crosstab(df["_ESPECIE"], df["_UA"])

    abun_geral = df["_ESPECIE"].value_counts().rename("Abundancia_Geral").to_frame()
    total_reg = float(abun_geral["Abundancia_Geral"].sum())
    abun_geral["Frequencia_Relativa_pct"] = 100.0 * (abun_geral["Abundancia_Geral"] / total_reg)

    def first_non_empty(series):
        s = series.dropna().astype(str).map(lambda x: x.strip()).replace("", np.nan).dropna()
        return s.iloc[0] if len(s) else np.nan

    meta_cols = {
        "ORDEM": "_ORDEM",
        "FAMILIA": "_FAMILIA",
        "NOME_COMUM": "_NOME_COMUM",
        "METODO": "_METODO",
        "DIETA": "_DIETA",
        "ENDEMISMO": "_ENDEMISMO",
        "IUCN": "_IUCN",
        "IBAMA_MMA": "_IBAMA_MMA",
        "SEMA_BA": "_SEMA_BA",
        "CITES": "_CITES",
    }

    meta = (df.groupby("_ESPECIE")
              .agg({v: first_non_empty for v in meta_cols.values()})
              .rename(columns={v: k for k, v in meta_cols.items()}))

    tabela17 = meta.join(sp_ua_counts, how="left").join(abun_geral, how="left").reset_index()
    tabela17 = tabela17.rename(columns={"_ESPECIE": "ESPECIE"})

    ua_cols = [c for c in tabela17.columns if c in sp_ua_counts.columns.tolist()]

    def ua_sort_key(x):
        m = re.search(r"(\d+)", str(x))
        return int(m.group(1)) if m else 9999

    ua_cols_sorted = sorted(ua_cols, key=ua_sort_key)

    fixed_cols = [
        "ORDEM", "FAMILIA", "ESPECIE", "NOME_COMUM", "METODO", "DIETA", "ENDEMISMO"
    ] + ua_cols_sorted + [
        "Abundancia_Geral", "Frequencia_Relativa_pct", "IUCN", "IBAMA_MMA", "SEMA_BA", "CITES"
    ]
    fixed_cols = [c for c in fixed_cols if c in tabela17.columns]

    tabela17 = tabela17[fixed_cols].copy()
    if "Abundancia_Geral" in tabela17.columns:
        tabela17["Abundancia_Geral"] = pd.to_numeric(tabela17["Abundancia_Geral"], errors="coerce").fillna(0).astype(int)
        tabela17 = tabela17.sort_values("Abundancia_Geral", ascending=False)

    # =========================
    # NOVO. ABUNDÂNCIA E RIQUEZA POR METODOLOGIA
    # =========================
    df_m = df[df["_METODO"].notna()].copy()

    if df_m.shape[0] > 0:
        abund_met = df_m.groupby("_METODO")["_ESPECIE"].size().rename("Abundancia").to_frame()
        riq_met = df_m.groupby("_METODO")["_ESPECIE"].nunique().rename("Riqueza").to_frame()
        tab_met = abund_met.join(riq_met).reset_index().rename(columns={"_METODO": "METODO"})
        tab_met = tab_met.sort_values("Abundancia", ascending=False)

        x = tab_met["METODO"].astype(str).values
        y_ab = tab_met["Abundancia"].astype(float).values
        y_riq = tab_met["Riqueza"].astype(float).values

        fig, ax1 = plt.subplots(figsize=(9, 5))
        ax1.bar(x, y_ab, label="Abundância", alpha=0.7, color=(178/255, 205/255, 225/255))
        ax1.set_ylabel("Abundância", color=(178/255, 205/255, 225/255))
        ax1.tick_params(axis='y', labelcolor=(178/255, 205/255, 225/255))
        ax1.set_xticks(range(len(x)))
        ax1.set_xticklabels(x, rotation=45, ha="right")

        ax2 = ax1.twinx()
        ax2.plot(x, y_riq, marker="o", linewidth=2, label="Riqueza", color="tab:red")
        ax2.set_ylabel("Riqueza", color="tab:red")
        ax2.tick_params(axis='y', labelcolor="tab:red")

        plt.title(f"Abundância e Riqueza por Metodologia. {base}\n{scenario_title}. {title_label}")
        h1, l1 = ax1.get_legend_handles_labels()
        h2, l2 = ax2.get_legend_handles_labels()
        ax1.legend(h1+h2, l1+l2, loc='upper right')
        fig.tight_layout()
        plt.savefig(os.path.join(path_graphs, f"{base}__{scenario_tag}__abund_riqueza_por_metodologia.png"), dpi=DPI)
        plt.close()

        tab_met.to_csv(
            os.path.join(path_tables, f"{base}__{scenario_tag}__abund_riqueza_por_metodologia.csv"),
            sep=";",
            encoding="utf-8",
            index=False
        )
    else:
        tab_met = pd.DataFrame(columns=["METODO", "Abundancia", "Riqueza"])

    # =========================
    # NOVO. ABUNDÂNCIA E RIQUEZA POR GUILDA TRÓFICA (DIETA)
    # =========================
    df_d = df[df["_DIETA"].notna()].copy()

    if df_d.shape[0] > 0:
        abund_diet = df_d.groupby("_DIETA")["_ESPECIE"].size().rename("Abundancia").to_frame()
        riq_diet = df_d.groupby("_DIETA")["_ESPECIE"].nunique().rename("Riqueza").to_frame()
        tab_diet = abund_diet.join(riq_diet).reset_index().rename(columns={"_DIETA": "GUILDA_TROFICA"})
        tab_diet = tab_diet.sort_values("Abundancia", ascending=False)

        x = tab_diet["GUILDA_TROFICA"].astype(str).values
        y_ab = tab_diet["Abundancia"].astype(float).values
        y_riq = tab_diet["Riqueza"].astype(float).values

        fig, ax1 = plt.subplots(figsize=(10, 6))
        ax1.bar(x, y_ab, label="Abundância", alpha=0.7, color=(178/255, 205/255, 225/255))
        ax1.set_ylabel("Abundância", color=(178/255, 205/255, 225/255))
        ax1.tick_params(axis='y', labelcolor=(178/255, 205/255, 225/255))
        ax1.set_xticks(range(len(x)))
        ax1.set_xticklabels(x, rotation=45, ha="right")

        ax2 = ax1.twinx()
        ax2.plot(x, y_riq, marker="o", linewidth=2, label="Riqueza", color="tab:red")
        ax2.set_ylabel("Riqueza", color="tab:red")
        ax2.tick_params(axis='y', labelcolor="tab:red")

        plt.title(f"Abundância e Riqueza por Guilda Trófica. {base}\n{scenario_title}. {title_label}")
        h1, l1 = ax1.get_legend_handles_labels()
        h2, l2 = ax2.get_legend_handles_labels()
        ax1.legend(h1+h2, l1+l2, loc='upper right')
        fig.tight_layout()
        plt.savefig(os.path.join(path_graphs, f"{base}__{scenario_tag}__abund_riqueza_por_guilda_trofica.png"), dpi=DPI)
        plt.close()

        tab_diet.to_csv(
            os.path.join(path_tables, f"{base}__{scenario_tag}__abund_riqueza_por_guilda_trofica.csv"),
            sep=";",
            encoding="utf-8",
            index=False
        )
    else:
        tab_diet = pd.DataFrame(columns=["GUILDA_TROFICA", "Abundancia", "Riqueza"])

    # =========================
    # NOVO. ABUNDÂNCIA E RIQUEZA POR UNIDADE AMOSTRAL (ÁREA)
    # =========================
    if not summary_ua.empty:
        def ua_sort_key(x):
            m = re.search(r"(\d+)", str(x))
            return int(m.group(1)) if m else 9999
        
        summary_ua_plot = summary_ua.copy()
        summary_ua_plot["sort_key"] = summary_ua_plot["_UA"].apply(ua_sort_key)
        summary_ua_plot = summary_ua_plot.sort_values("sort_key")

        fig, ax1 = plt.subplots(figsize=(12, 6))
        x_ua = summary_ua_plot["_UA"].astype(str).values
        y_ab_ua = summary_ua_plot["Abundancia_registros"].astype(float).values
        y_riq_ua = summary_ua_plot["Riqueza_Sobs"].astype(float).values

        ax1.bar(x_ua, y_ab_ua, label="Abundância (registros)", alpha=0.7, color=(178/255, 205/255, 225/255))
        ax1.set_ylabel("Abundância (registros)", color=(178/255, 205/255, 225/255))
        ax1.tick_params(axis='y', labelcolor=(178/255, 205/255, 225/255))
        ax1.set_xticks(range(len(x_ua)))
        ax1.set_xticklabels(x_ua, rotation=45, ha="right")

        ax2 = ax1.twinx()
        ax2.plot(x_ua, y_riq_ua, marker="o", linewidth=2, label="Riqueza (Sobs)", color="tab:red")
        ax2.set_ylabel("Riqueza (Sobs)", color="tab:red")
        ax2.tick_params(axis='y', labelcolor="tab:red")

        plt.title(f"Abundância e Riqueza por Unidade Amostral (Área). {base}\n{scenario_title}. {title_label}")
        h1, l1 = ax1.get_legend_handles_labels()
        h2, l2 = ax2.get_legend_handles_labels()
        ax1.legend(h1+h2, l1+l2, loc='upper right')
        fig.tight_layout()
        plt.savefig(os.path.join(path_graphs, f"{base}__{scenario_tag}__abund_riqueza_por_unidade_amostral.png"), dpi=DPI)
        plt.close()

    # =========================
    # NOVO. RESUMO POR GRUPOS DE CAMPANHAS (ANOS)
    # =========================
    bins_anos = [
        ("Campanhas 2019 (C1 e C2)", [1, 2]),
        ("Campanhas 2020 (C3 e C4)", [3, 4]),
        ("Campanhas 2021 (C5 a C7)", [5, 6, 7]),
        ("Campanhas 2022 (C8 a C11)", [8, 9, 10, 11]),
        ("Campanhas 2023 (C12 a C14)", [12, 13, 14]),
        ("Campanhas 2024 (C15 e C16)", [15, 16]),
        ("Campanhas 2025 (C17 e C22)", list(range(17, 23))),
    ]

    res_anos = []
    for label, camps in bins_anos:
        sub = df[df["_CAMPANHA_NUM"].isin(camps)]
        if sub.shape[0] > 0:
            res_anos.append({
                "Periodo": label,
                "Abundância (N)": int(sub.shape[0]),
                "Riqueza (S)": int(sub["_ESPECIE"].nunique())
            })

    if res_anos:
        tab_anos = pd.DataFrame(res_anos)
        total_n = int(df.shape[0])
        total_s = int(df["_ESPECIE"].nunique())

        total_row = pd.DataFrame([{
            "Periodo": "TOTAL",
            "Abundância (N)": total_n,
            "Riqueza (S)": total_s
        }])
        tab_anos = pd.concat([tab_anos, total_row], ignore_index=True)
    else:
        tab_anos = pd.DataFrame(columns=["Periodo", "Abundância (N)", "Riqueza (S)"])

    # =========================
    # EXPORTA MATRIZES
    # =========================
    sample_species_counts.to_csv(
        os.path.join(path_tables, f"{base}__{scenario_tag}__matriz_amostra_especie_contagens.csv"),
        sep=";",
        encoding="utf-8"
    )
    (sample_species_counts > 0).astype(int).to_csv(
        os.path.join(path_tables, f"{base}__{scenario_tag}__matriz_amostra_especie_incidencia.csv"),
        sep=";",
        encoding="utf-8"
    )

    # =========================
    # EXPORTA EXCEL
    # =========================
    xlsx_out = os.path.join(path_tables, f"{base}__{scenario_tag}__RESULTADOS.xlsx")

    keep_raw_cols = pick_existing_columns(df, REQUESTED_VARIABLES)
    df_raw_export = df[keep_raw_cols].copy() if keep_raw_cols else df.copy()

    with pd.ExcelWriter(xlsx_out, engine="openpyxl") as writer:
        summary_campaign.rename(columns={"_CAMPANHA": "CAMPANHA"}).to_excel(writer, index=False, sheet_name="Riq_Abun_por_Campanha")
        summary_ua.rename(columns={"_UA": "UNIDADE_AMOSTRAL"}).to_excel(writer, index=False, sheet_name="Riq_Abun_por_UA")
        fam_summary.to_excel(writer, index=False, sheet_name="Familias_Riq_Abun")
        sp_top.to_excel(writer, index=False, sheet_name="Especies_Top_Geral")
        sp_by_ua.to_excel(writer, index=False, sheet_name="Especies_Top_por_UA")
        sp_relfreq.to_excel(writer, index=False, sheet_name="Freq_Rel_Especies")
        div_campaign.to_excel(writer, index=False, sheet_name="Diversidade_por_Campanha")
        div_ua.to_excel(writer, index=False, sheet_name="Diversidade_por_UA")
        div_sample.to_excel(writer, index=False, sheet_name="Diversidade_por_Amostra")
        accum_table.to_excel(writer, index=False, sheet_name="Curva_Acumulacao")
        threatened_species.to_excel(writer, index=False, sheet_name="Especies_Ameacadas")
        endemic_species.to_excel(writer, index=False, sheet_name="Especies_Endemicas")
        tabela17.to_excel(writer, index=False, sheet_name="Tabela_Especies_UA")
        tab_met.to_excel(writer, index=False, sheet_name="Abund_Riq_por_Metodo")
        tab_diet.to_excel(writer, index=False, sheet_name="Abund_Riq_por_Guilda")
        tab_anos.to_excel(writer, index=False, sheet_name="Resumo_Anual_Campanhas")
        df_raw_export.to_excel(writer, index=False, sheet_name="Dados_Brutos_Usados")

    summary = {
        "cenario": scenario_tag,
        "title_label": title_label,
        "linhas_registros": int(df.shape[0]),
        "riqueza_total": int(df["_ESPECIE"].nunique()),
        "abundancia_total_registros": int(df.shape[0]),
        "saida_excel": xlsx_out,
    }
    return summary

# =========================
# PIPELINE PRINCIPAL POR ARQUIVO
# =========================
def run_pipeline(xlsx_path: str, outdir: str):
    base = os.path.splitext(os.path.basename(xlsx_path))[0]

    xls = pd.ExcelFile(xlsx_path, engine="openpyxl")
    sheet0 = xls.sheet_names[0]
    df0 = pd.read_excel(xlsx_path, sheet_name=sheet0, engine="openpyxl")

    # Colunas essenciais
    col_campaign = find_col(df0, ["CAMPANHA"])
    col_unit = find_col(df0, ["UNIDADE AMOSTRAL", "UNIDADE_AMOSTRAL", "UA"])
    col_species = find_col(df0, ["ESPECIE", "ESPÉCIE"])
    col_family = find_col(df0, ["FAMILIA", "FAMÍLIA"])

    # Colunas opcionais de status
    col_iucn = find_col(df0, ["IUCN", "IUCN (GLOBAL)"])
    col_ibama = find_col(df0, ["IBAMA/MMA", "IBAMA", "MMA"])
    col_sema = find_col(df0, ["SEMA/BA", "SEMA", "SEMA BA"])
    col_cites = find_col(df0, ["CITES", "CITES (2023)"])

    # Colunas opcionais para Tabela 17 e gráfico por metodologia
    col_metodo_analise = find_col(df0, ["METODO", "MÉTODO"])
    col_nome_comum = find_col(df0, ["NOME COMUM", "NOME_COMUM", "NOMEPOPULAR", "NOME POPULAR"])
    col_dieta = find_col(df0, ["DIETA"])
    col_endemismo = find_col(df0, ["ENDEMISMO"])
    col_ordem = find_col(df0, ["ORDEM"])

    # Para remover "Encontro ocasional" antes de qualquer recorte
    col_modo_reg = find_col(df0, ["MODO DE REGISTRO", "MODO_REGISTRO", "MODO"])
    col_metodo_filtro = find_col(df0, ["METODO", "MÉTODO"])

    missing = [k for k, v in {
        "CAMPANHA": col_campaign,
        "UNIDADE_AMOSTRAL": col_unit,
        "ESPECIE": col_species,
        "FAMILIA": col_family,
    }.items() if v is None]

    if missing:
        raise ValueError(
            f"[{base}] Colunas essenciais ausentes: {missing}. "
            f"Colunas disponíveis: {list(df0.columns)}"
        )

    # Lógica de separação por Grupo Taxonômico para Mastofauna
    col_tax_group = find_col(df0, ["GRUPOS", "GRUPO TAXONOMICO", "GRUPO_TAXONOMICO", "GRUPO"])
    subsets = [(base, df0)]
    if ("MASTOFAUNA" in base.upper() or "MAMIFERO" in base.upper()) and col_tax_group:
        subsets = []
        df0["_G_NORM"] = df0[col_tax_group].apply(norm_value)
        for g_val in sorted(df0["_G_NORM"].unique()):
            if not g_val: continue
            suffix = g_val.replace(" ", "_")
            subsets.append((f"{base}_{suffix}", df0[df0["_G_NORM"] == g_val].copy()))

    # Numérico para recortes
    camp_num = df0[col_campaign].apply(parse_campaign_number)

    all_results = []
    for b_name, df_work in subsets:
        out_base_sub = os.path.join(outdir, b_name)
        os.makedirs(out_base_sub, exist_ok=True)
        
        scenario_summaries = []
        for sc in SCENARIOS:
            df_sc = df_work.loc[camp_num.between(sc["min"], sc["max"], inclusive="both")].copy()

            if df_sc.shape[0] == 0:
                print(f"      [AVISO] Sem dados para o cenário {sc['tag']} em {b_name}. Pulando...")
                continue

            res_sc = run_analysis_on_df(
                df=df_sc,
                base=b_name,
                out_base=out_base_sub,
                scenario_tag=sc["tag"],
                scenario_title=sc["title"],
                sc_min=sc["min"],
                sc_max=sc["max"],
                col_campaign=col_campaign,
                col_unit=col_unit,
                col_species=col_species,
                col_family=col_family,
                col_iucn=col_iucn,
                col_ibama=col_ibama,
                col_sema=col_sema,
                col_metodo=col_metodo_analise,
                col_nome_comum=col_nome_comum,
                col_dieta=col_dieta,
                col_endemismo=col_endemismo,
                col_ordem=col_ordem,
                col_cites=col_cites,
                col_modo_reg=col_modo_reg,
                col_metodo_filtro=col_metodo_filtro
            )
            scenario_summaries.append(res_sc)

        if scenario_summaries:
            comp = pd.DataFrame(scenario_summaries)
            comp_out = os.path.join(out_base_sub, f"{b_name}__COMPARATIVO_C17_22_vs_C05_22.xlsx")
            with pd.ExcelWriter(comp_out, engine="openpyxl") as writer:
                comp.to_excel(writer, index=False, sheet_name="Resumo")

            all_results.append({
                "arquivo": b_name,
                "saida_dir": out_base_sub,
                "comparativo_excel": comp_out,
            })
    return all_results

def main():
    os.makedirs(OUTDIR, exist_ok=True)
    logs = []
    for f in INPUT_FILES:
        if not os.path.exists(f):
            print(f"\n[ERRO] Arquivo não encontrado: {f}\nVerifique se o nome está correto ou se há problemas de acentuação. Pulando.\n")
            continue
        print(f"Processando: {f}")
        s = run_pipeline(f, OUTDIR)
        logs.extend(s)

    log_df = pd.DataFrame(logs)
    log_df.to_csv(
        os.path.join(OUTDIR, "LOG_RESUMO_PROCESSAMENTO.csv"),
        index=False,
        sep=";",
        encoding="utf-8"
    )
    print("Concluído. Resultados em:", OUTDIR)
    print(log_df)

if __name__ == "__main__":
    main()