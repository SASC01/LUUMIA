/* Generado desde OpenAPI. Ejecuta npm run contracts:types. */
export interface paths {
    "/v1/market-references/{series_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Market Reference
         * @description Consulta SNIIM y resume los precios de la serie solicitada.
         */
        get: operations["market_reference_v1_market_references__series_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/usda-references/mexico-corn-production": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Usda Reference
         * @description Consulta las cinco campañas más recientes en la publicación PSD de maíz nacional.
         */
        get: operations["usda_reference_v1_usda_references_mexico_corn_production_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/integrations/kobo/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Integration Status */
        get: operations["integration_status_integrations_kobo_status_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/integrations/kobo/formList": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Kobo Form List */
        get: operations["kobo_form_list_integrations_kobo_formList_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/integrations/kobo/forms/don-tino-rain": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Kobo Form Xml */
        get: operations["kobo_form_xml_integrations_kobo_forms_don_tino_rain_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/integrations/kobo/submission": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Kobo Submission */
        post: operations["kobo_submission_integrations_kobo_submission_post"];
        delete?: never;
        options?: never;
        /** Kobo Submission Check */
        head: operations["kobo_submission_check_integrations_kobo_submission_head"];
        patch?: never;
        trace?: never;
    };
    "/v1/weatherlink/current": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Weatherlink Current
         * @description Consulta una estación configurada por el servidor o muestra el ejemplo documental.
         */
        get: operations["weatherlink_current_v1_weatherlink_current_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/sowing-plan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Sowing Plan */
        get: operations["get_sowing_plan_v1_contexts__parcel_id__sowing_plan_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/sowing-plan/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Preview Sowing Plan */
        post: operations["preview_sowing_plan_v1_contexts__parcel_id__sowing_plan_preview_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/sowing-plan/draft": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Save Sowing Plan */
        put: operations["save_sowing_plan_v1_contexts__parcel_id__sowing_plan_draft_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/sowing-plan/share": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Share Sowing Plan */
        post: operations["share_sowing_plan_v1_contexts__parcel_id__sowing_plan_share_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/sowing-metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Sowing Metrics */
        get: operations["get_sowing_metrics_v1_contexts__parcel_id__sowing_metrics_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/sowing-sales": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Sowing Sales */
        get: operations["get_sowing_sales_v1_contexts__parcel_id__sowing_sales_get"];
        put?: never;
        /** Create Zone Sale */
        post: operations["create_zone_sale_v1_contexts__parcel_id__sowing_sales_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/sowing-sales/{sale_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Correct Zone Sale */
        put: operations["correct_zone_sale_v1_contexts__parcel_id__sowing_sales__sale_id__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/sowing-sales/{sale_id}/void": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Void Zone Sale */
        post: operations["void_zone_sale_v1_contexts__parcel_id__sowing_sales__sale_id__void_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/cooperative-capacities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Cooperative Capacity */
        post: operations["create_cooperative_capacity_v1_contexts__parcel_id__cooperative_capacities_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/cooperative-capacities/{capacity_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Correct Cooperative Capacity */
        put: operations["correct_cooperative_capacity_v1_contexts__parcel_id__cooperative_capacities__capacity_id__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/cooperative-capacities/{capacity_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel Cooperative Capacity */
        post: operations["cancel_cooperative_capacity_v1_contexts__parcel_id__cooperative_capacities__capacity_id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/registered-area": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Put Registered Area */
        put: operations["put_registered_area_v1_contexts__parcel_id__registered_area_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/parcels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Local Parcels */
        get: operations["list_local_parcels_v1_parcels_get"];
        put?: never;
        /** Create Local Parcel */
        post: operations["create_local_parcel_v1_parcels_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/crop-cycles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Post Crop Cycle
         * @description Agrega un ciclo observado y guarda la rotación calculada con la misma versión.
         */
        post: operations["post_crop_cycle_v1_contexts__parcel_id__crop_cycles_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/crop-cycles/{cycle_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Correct Crop Cycle */
        put: operations["correct_crop_cycle_v1_contexts__parcel_id__crop_cycles__cycle_id__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/crop-cycles/{cycle_id}/void": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Void Crop Cycle */
        post: operations["void_crop_cycle_v1_contexts__parcel_id__crop_cycles__cycle_id__void_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/crop-rotation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Refresh Local Rotation */
        post: operations["refresh_local_rotation_v1_contexts__parcel_id__crop_rotation_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/yield-references/{crop_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Municipal Yield Reference
         * @description Consulta los cierres de temporal de Hopelchén por cultivo y ciclo agrícola.
         */
        get: operations["municipal_yield_reference_v1_yield_references__crop_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/demo/don-tino/context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Fixture Context */
        get: operations["fixture_context_demo_don_tino_context_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/demo/don-tino/collection-request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Fixture Collection */
        get: operations["fixture_collection_demo_don_tino_collection_request_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/demo/don-tino/power-snapshot": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Power Snapshot */
        get: operations["power_snapshot_demo_don_tino_power_snapshot_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/demo/don-tino/evaluation-request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Fixture Evaluation */
        get: operations["fixture_evaluation_demo_don_tino_evaluation_request_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/demo/don-tino/p1": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Demo P1 */
        get: operations["demo_p1_demo_don_tino_p1_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/collections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Collect */
        post: operations["collect_v1_collections_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/harmonizations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Harmonize */
        post: operations["harmonize_v1_harmonizations_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/features": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Features */
        post: operations["features_v1_features_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/evaluations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Evaluate */
        post: operations["evaluate_v1_evaluations_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Current Context */
        get: operations["current_context_v1_contexts__parcel_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/cycle-plan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Plan Cycle */
        post: operations["plan_cycle_v1_contexts__parcel_id__cycle_plan_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/versions/{version}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Historical Context */
        get: operations["historical_context_v1_contexts__parcel_id__versions__version__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/demo/don-tino/assistant-context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Fixture Assistant */
        get: operations["fixture_assistant_demo_don_tino_assistant_context_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/explanations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Explanation */
        post: operations["explanation_v1_contexts__parcel_id__explanations_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contexts/{parcel_id}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Context */
        post: operations["create_context_v1_contexts__parcel_id__versions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/field-observations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Local Observation */
        post: operations["local_observation_v1_field_observations_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/decisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Decisions */
        post: operations["decisions_v1_decisions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** AnnualPriceForecast */
        AnnualPriceForecast: {
            /**
             * Period Start
             * Format: date
             */
            period_start: string;
            /**
             * Period End
             * Format: date
             */
            period_end: string;
            /** Low */
            low: string;
            /** Central */
            central: string;
            /** High */
            high: string;
            /**
             * Aggregation
             * @default mean_of_monthly_scenarios
             * @constant
             */
            aggregation: "mean_of_monthly_scenarios";
        };
        /** ApiError */
        ApiError: {
            /**
             * Contract Version
             * @default 0.2.0
             * @enum {string}
             */
            contract_version: "0.1.0" | "0.2.0";
            /** Code */
            code: string;
            /** Message */
            message: string;
            /** Module */
            module: string;
        };
        /** AppliedYield */
        AppliedYield: {
            /**
             * Method Version
             * @default crop-yield-area-1
             * @constant
             */
            method_version: "crop-yield-area-1";
            /**
             * Evidence Tier
             * @default simulated_assumption
             * @constant
             */
            evidence_tier: "simulated_assumption";
            /** Crop Id */
            crop_id: string;
            /** Cycle Offset */
            cycle_offset: number;
            /** Agricultural Cycle */
            agricultural_cycle: ("spring_summer" | "fall_winter") | null;
            /** Area Ha */
            area_ha: string;
            /** Yield T Ha */
            yield_t_ha: string;
            assumption: components["schemas"]["YieldAssumption"];
            /** Reference Source Url */
            reference_source_url?: string | null;
            /** Reference N */
            reference_n?: number | null;
            /** Reference Period Start */
            reference_period_start?: number | null;
            /** Reference Period End */
            reference_period_end?: number | null;
        };
        /** AssistantCommercialSummary */
        AssistantCommercialSummary: {
            /**
             * Status
             * @enum {string}
             */
            status: "available" | "stale" | "missing";
            /** Scenario Id */
            scenario_id?: string | null;
            result?: components["schemas"]["CommercialResult"] | null;
            /** Assumptions */
            assumptions?: string[];
            /** Reason */
            reason?: string | null;
        };
        /** AssistantContext */
        AssistantContext: {
            /**
             * Contract Version
             * @default 0.2.0
             * @enum {string}
             */
            contract_version: "0.1.0" | "0.2.0";
            /** Parcel Id */
            parcel_id: string;
            /** Context Version */
            context_version: number;
            /** Evaluation Id */
            evaluation_id?: string | null;
            /** Evaluation State */
            evaluation_state?: ("vigente" | "pendiente_de_recalculo") | null;
            /**
             * Data Kind
             * @enum {string}
             */
            data_kind: "observed" | "derived" | "synthetic";
            exclusion?: components["schemas"]["AssistantExclusion"] | null;
            /** Evidence Blocks */
            evidence_blocks?: {
                [key: string]: ("observed" | "derived" | "simulated_assumption") | null;
            };
            commercial_summary: components["schemas"]["AssistantCommercialSummary"];
            /** Summary Es */
            summary_es: string;
            /** Allowed Tools */
            allowed_tools?: "read_context_detail"[];
        };
        /** AssistantExclusion */
        AssistantExclusion: {
            /** Candidate Id */
            candidate_id: string;
            /** Candidate Label */
            candidate_label: string;
            primary_check: components["schemas"]["ConstraintCheck"];
        };
        /** BlockEvidence */
        BlockEvidence: {
            /** Evidence Tier */
            evidence_tier: ("observed" | "derived" | "simulated_assumption") | null;
            /**
             * Status
             * @enum {string}
             */
            status: "available" | "missing";
            /** Missing Reason */
            missing_reason?: string | null;
            /** N Observaciones */
            n_observaciones: number;
            /** Count Unit */
            count_unit: string;
            /**
             * N Simulated
             * @default 0
             */
            n_simulated: number;
            confidence: components["schemas"]["Confidence"];
            /** Sources */
            sources?: components["schemas"]["Source"][];
        };
        /** BuyerRefusal */
        BuyerRefusal: {
            /** Crop Id */
            crop_id: string;
            /** Cycle Offset */
            cycle_offset: number;
            sales_period: components["schemas"]["Period"];
            /**
             * Documented At
             * Format: date-time
             */
            documented_at: string;
            source: components["schemas"]["Source"];
            /**
             * Data Kind
             * @enum {string}
             */
            data_kind: "observed" | "synthetic";
        };
        /** Candidate */
        Candidate: {
            /** Id */
            id: string;
            /** Label */
            label: string;
            /** Steps */
            steps: components["schemas"]["RotationStep"][];
        };
        /** CollectionRequest */
        CollectionRequest: {
            /**
             * Contract Version
             * @default 0.1.0
             * @enum {string}
             */
            contract_version: "0.1.0" | "0.2.0";
            /** Parcel Id */
            parcel_id: string;
            /** Geometry */
            geometry: {
                [key: string]: unknown;
            };
            period: components["schemas"]["Period"];
            /** Variables */
            variables: string[];
        };
        /** CollectionResult */
        CollectionResult: {
            /**
             * Contract Version
             * @default 0.1.0
             * @enum {string}
             */
            contract_version: "0.1.0" | "0.2.0";
            request: components["schemas"]["CollectionRequest"];
            /** Observations */
            observations: components["schemas"]["Observation"][];
            /** Warnings */
            warnings: string[];
        };
        /** CommercialEndpoint */
        CommercialEndpoint: {
            /** Cupo Kg */
            cupo_kg: number;
            /** Kg Disponibles */
            kg_disponibles: string;
            /** Kg Vendidos */
            kg_vendidos: string;
            /** Kg Sin Salida */
            kg_sin_salida: string;
            /** Margen Mxn */
            margen_mxn: string;
            /** Ingreso Mxn */
            ingreso_mxn?: string | null;
            /** Precio Efectivo Mxn Kg */
            precio_efectivo_mxn_kg?: string | null;
            /** Precio Equilibrio Mxn Kg */
            precio_equilibrio_mxn_kg: string | null;
            /**
             * Precio Equilibrio Status
             * @enum {string}
             */
            precio_equilibrio_status: "available" | "missing";
            /** Precio Equilibrio Missing Reason */
            precio_equilibrio_missing_reason?: string | null;
        };
        /** CommercialResult */
        CommercialResult: {
            /** Scenario Id */
            scenario_id: string;
            /** Method Version */
            method_version: string;
            /**
             * Evidence Tier
             * @enum {string}
             */
            evidence_tier: "observed" | "derived" | "simulated_assumption";
            /** Label Es */
            label_es: string;
            /** Precio Base Mxn Kg */
            precio_base_mxn_kg?: string | null;
            precio_volumen?: components["schemas"]["PriceVolumeAssumption-Output"] | null;
            applied_yield?: components["schemas"]["AppliedYield"] | null;
            /** Cupo Centro Kg */
            cupo_centro_kg: string;
            /** Cupo Amplitud Kg */
            cupo_amplitud_kg: number;
            /** Kg Cosechados */
            kg_cosechados: string;
            /** Costos Totales Mxn */
            costos_totales_mxn: string;
            bajo: components["schemas"]["CommercialEndpoint"];
            alto: components["schemas"]["CommercialEndpoint"];
            /** Margen Min Mxn */
            margen_min_mxn: string;
            /** Margen Max Mxn */
            margen_max_mxn: string;
        };
        /** CommercialScenario */
        "CommercialScenario-Input": {
            /** Id */
            id: string;
            /** Candidate Id */
            candidate_id: string;
            /** Crop Id */
            crop_id: string;
            /** Cycle Offset */
            cycle_offset: number;
            sales_period: components["schemas"]["Period"];
            /**
             * Sales Structure
             * @enum {string}
             */
            sales_structure: "spot" | "cooperative" | "buyer_contract";
            /** Cupo Range */
            cupo_range: [
                number,
                number
            ];
            /** Cupo Confirmacion */
            cupo_confirmacion?: string | null;
            /** Superficie Ha */
            superficie_ha: number | string;
            /** Precio Productor Mxn Kg */
            precio_productor_mxn_kg: number | string;
            precio_volumen?: components["schemas"]["PriceVolumeAssumption-Input"] | null;
            /** Rendimiento Esperado T Ha */
            rendimiento_esperado_t_ha: number | string;
            /** Agricultural Cycle */
            agricultural_cycle?: ("spring_summer" | "fall_winter") | null;
            yield_assumption?: components["schemas"]["YieldAssumption"] | null;
            /** Merma Fraccion */
            merma_fraccion: number | string;
            /** Costos Produccion Mxn */
            costos_produccion_mxn: number | string;
            /** Costos Empaque Mxn */
            costos_empaque_mxn: number | string;
            /** Costos Transporte Mxn */
            costos_transporte_mxn: number | string;
            /** Costos Venta Mxn */
            costos_venta_mxn: number | string;
            /** Supuestos */
            supuestos?: string[];
            /** Fuentes Insumos */
            fuentes_insumos?: {
                [key: string]: components["schemas"]["Source"];
            };
        };
        /** CommercialScenario */
        "CommercialScenario-Output": {
            /** Id */
            id: string;
            /** Candidate Id */
            candidate_id: string;
            /** Crop Id */
            crop_id: string;
            /** Cycle Offset */
            cycle_offset: number;
            sales_period: components["schemas"]["Period"];
            /**
             * Sales Structure
             * @enum {string}
             */
            sales_structure: "spot" | "cooperative" | "buyer_contract";
            /** Cupo Range */
            cupo_range: [
                number,
                number
            ];
            /** Cupo Confirmacion */
            cupo_confirmacion?: string | null;
            /** Superficie Ha */
            superficie_ha: string;
            /** Precio Productor Mxn Kg */
            precio_productor_mxn_kg: string;
            precio_volumen?: components["schemas"]["PriceVolumeAssumption-Output"] | null;
            /** Rendimiento Esperado T Ha */
            rendimiento_esperado_t_ha: string;
            /** Agricultural Cycle */
            agricultural_cycle?: ("spring_summer" | "fall_winter") | null;
            yield_assumption?: components["schemas"]["YieldAssumption"] | null;
            /** Merma Fraccion */
            merma_fraccion: string;
            /** Costos Produccion Mxn */
            costos_produccion_mxn: string;
            /** Costos Empaque Mxn */
            costos_empaque_mxn: string;
            /** Costos Transporte Mxn */
            costos_transporte_mxn: string;
            /** Costos Venta Mxn */
            costos_venta_mxn: string;
            /** Supuestos */
            supuestos?: string[];
            /** Fuentes Insumos */
            fuentes_insumos?: {
                [key: string]: components["schemas"]["Source"];
            };
        };
        /** Confidence */
        Confidence: {
            /**
             * Level
             * @enum {string}
             */
            level: "high" | "medium" | "low" | "unknown";
            /** Reasons */
            reasons: string[];
        } & {
            [key: string]: unknown;
        };
        /** ConfirmedCapacity */
        ConfirmedCapacity: {
            /** Id */
            id: string;
            /** Crop Id */
            crop_id: string;
            /** Cycle Offset */
            cycle_offset: number;
            sales_period: components["schemas"]["Period"];
            /**
             * Sales Structure
             * @enum {string}
             */
            sales_structure: "spot" | "cooperative" | "buyer_contract";
            /** Cupo Range */
            cupo_range: [
                number,
                number
            ];
            /**
             * Confirmed At
             * Format: date-time
             */
            confirmed_at: string;
            source: components["schemas"]["Source"];
        };
        /** ConstraintCheck */
        ConstraintCheck: {
            /** Constraint Id */
            constraint_id: string;
            /**
             * Outcome
             * @enum {string}
             */
            outcome: "pass" | "fail" | "needs_confirmation";
            /** Explanation */
            explanation: string;
            /** Evidence Tier */
            evidence_tier?: ("observed" | "derived" | "simulated_assumption") | null;
            /** Evidence */
            evidence?: components["schemas"]["EvidenceRef"][];
            source?: components["schemas"]["Source"] | null;
            /** Documented At */
            documented_at?: string | null;
        } & {
            [key: string]: unknown;
        };
        /** ContextSaveRequest */
        ContextSaveRequest: {
            request: components["schemas"]["EvaluationRequest-Input"];
            /** Weekly Cells */
            weekly_cells: components["schemas"]["WeeklyCell"][];
            /** Expected Context Version */
            expected_context_version: number;
        };
        /** CooperativeCapacityCancellation */
        CooperativeCapacityCancellation: {
            /** Expected Context Version */
            expected_context_version: number;
            /** Reason */
            reason?: string | null;
        };
        /** CooperativeCapacityCorrection */
        CooperativeCapacityCorrection: {
            /** Expected Context Version */
            expected_context_version: number;
            /**
             * Crop Id
             * @enum {string}
             */
            crop_id: "calabaza" | "frijol" | "maiz" | "saladette";
            sales_period: components["schemas"]["Period"];
            /** Cupo Range */
            cupo_range: [
                number,
                number
            ];
            /**
             * Confirmed On
             * Format: date
             */
            confirmed_on: string;
            /** Source Name */
            source_name: string;
            /** Source Url */
            source_url?: string | null;
            /** Reason */
            reason?: string | null;
        };
        /** CooperativeCapacityHistoryEntry */
        CooperativeCapacityHistoryEntry: {
            /**
             * Action
             * @enum {string}
             */
            action: "corrected" | "cancelled";
            previous: components["schemas"]["ConfirmedCapacity"];
            replacement: components["schemas"]["ConfirmedCapacity"] | null;
            /**
             * Recorded At
             * Format: date-time
             */
            recorded_at: string;
            /** Context Version */
            context_version: number;
            /** Reason */
            reason?: string | null;
        };
        /** CooperativeCapacityRegistration */
        CooperativeCapacityRegistration: {
            /** Expected Context Version */
            expected_context_version: number;
            /**
             * Crop Id
             * @enum {string}
             */
            crop_id: "calabaza" | "frijol" | "maiz" | "saladette";
            sales_period: components["schemas"]["Period"];
            /** Cupo Range */
            cupo_range: [
                number,
                number
            ];
            /**
             * Confirmed On
             * Format: date
             */
            confirmed_on: string;
            /** Source Name */
            source_name: string;
            /** Source Url */
            source_url?: string | null;
        };
        /** CropCycle */
        CropCycle: {
            /** Id */
            id: string;
            /** Sequence */
            sequence: number;
            period: components["schemas"]["Period"] | null;
            /** Crop Ids */
            crop_ids: string[];
            /**
             * Data Kind
             * @enum {string}
             */
            data_kind: "observed" | "synthetic";
        } & {
            [key: string]: unknown;
        };
        /** CropCycleChange */
        CropCycleChange: {
            /**
             * Change Id
             * Format: uuid
             */
            change_id: string;
            /**
             * Action
             * @enum {string}
             */
            action: "corrected" | "voided";
            /**
             * Recorded At
             * Format: date-time
             */
            recorded_at: string;
            /** Context Version */
            context_version: number;
            previous: components["schemas"]["CropCycle"];
            replacement?: components["schemas"]["CropCycle"] | null;
            /** Reason */
            reason?: string | null;
        };
        /** CropCycleCorrection */
        CropCycleCorrection: {
            /** Expected Context Version */
            expected_context_version: number;
            /**
             * Change Id
             * Format: uuid
             */
            change_id: string;
            /** Reason */
            reason?: string | null;
            /**
             * Crop Id
             * @enum {string}
             */
            crop_id: "calabaza" | "frijol" | "maiz" | "saladette";
            /**
             * Start
             * Format: date
             */
            start: string;
            /**
             * End
             * Format: date
             */
            end: string;
        };
        /** CropCycleRegistration */
        CropCycleRegistration: {
            /** Expected Context Version */
            expected_context_version: number;
            /**
             * Kind
             * @enum {string}
             */
            kind: "current" | "previous";
            /**
             * Crop Id
             * @enum {string}
             */
            crop_id: "calabaza" | "frijol" | "maiz" | "saladette";
            /**
             * Start
             * Format: date
             */
            start: string;
            /**
             * End
             * Format: date
             */
            end: string;
        };
        /** CropCycleVoid */
        CropCycleVoid: {
            /** Expected Context Version */
            expected_context_version: number;
            /**
             * Change Id
             * Format: uuid
             */
            change_id: string;
            /** Reason */
            reason?: string | null;
        };
        /** CycleAssumption */
        "CycleAssumption-Input": {
            /** Crop Id */
            crop_id: string;
            /** Local Price Mxn Kg */
            local_price_mxn_kg?: number | string | null;
            /** Yield T Ha */
            yield_t_ha?: number | string | null;
            /** Loss Fraction */
            loss_fraction?: number | string | null;
            /** Cost Mxn */
            cost_mxn?: number | string | null;
            /** Capacity Kg */
            capacity_kg?: number | null;
            /** Soil Cover */
            soil_cover?: boolean | null;
        };
        /** CycleAssumption */
        "CycleAssumption-Output": {
            /** Crop Id */
            crop_id: string;
            /** Local Price Mxn Kg */
            local_price_mxn_kg?: string | null;
            /** Yield T Ha */
            yield_t_ha?: string | null;
            /** Loss Fraction */
            loss_fraction?: string | null;
            /** Cost Mxn */
            cost_mxn?: string | null;
            /** Capacity Kg */
            capacity_kg?: number | null;
            /** Soil Cover */
            soil_cover?: boolean | null;
        };
        /** CycleCrop */
        CycleCrop: {
            /** Crop Id */
            crop_id: string;
            /** Label */
            label: string;
            /** Candidate Ids */
            candidate_ids: string[];
            /** Natural Rank */
            natural_rank?: number | null;
            /** Natural Score */
            natural_score: number | null;
            /** Soil Signals */
            soil_signals: string[];
            /** Soil Practice */
            soil_practice: string | null;
            /** Soil Pass */
            soil_pass: boolean;
            /** Viable */
            viable: boolean;
            /** Eligibility Reason */
            eligibility_reason: string | null;
            assumption: components["schemas"]["CycleAssumption-Output"];
            /**
             * Yield Basis
             * @enum {string}
             */
            yield_basis: "municipal_median" | "demo_assumption" | "user_assumption" | "missing";
            /** Yield Reference Url */
            yield_reference_url?: string | null;
            economics: components["schemas"]["CycleEconomics"] | null;
            /** Missing Reason */
            missing_reason: string | null;
        };
        /** CycleEconomics */
        CycleEconomics: {
            /** Price Mxn Kg */
            price_mxn_kg: string;
            /** Price Low Mxn Kg */
            price_low_mxn_kg: string | null;
            /** Price High Mxn Kg */
            price_high_mxn_kg: string | null;
            /** Harvest Kg */
            harvest_kg: string;
            /** Sold Kg */
            sold_kg: string;
            /** Revenue Mxn */
            revenue_mxn: string;
            /** Cost Mxn */
            cost_mxn: string;
            /** Margin Mxn */
            margin_mxn: string;
            /** Margin Low Mxn */
            margin_low_mxn: string | null;
            /** Margin High Mxn */
            margin_high_mxn: string | null;
            /**
             * Price Basis
             * @enum {string}
             */
            price_basis: "local_forecast" | "mexican_observation" | "international_index" | "local_assumption";
            /** Reference Series Id */
            reference_series_id?: string | null;
            /** Reference Geography */
            reference_geography?: string | null;
            /** Reference Product */
            reference_product?: string | null;
            /** Reference Observed Month */
            reference_observed_month?: string | null;
            /** Reference Observed Url */
            reference_observed_url?: string | null;
        };
        /** CyclePlan */
        CyclePlan: {
            /** Context Version */
            context_version: number;
            /** Sale Month */
            sale_month: string;
            /**
             * As Of
             * Format: date
             */
            as_of: string;
            /**
             * Price Mode
             * @enum {string}
             */
            price_mode: "forecast" | "mexican_observation";
            /** Area Ha */
            area_ha: string;
            /**
             * Agricultural Cycle
             * @default spring_summer
             * @constant
             */
            agricultural_cycle: "spring_summer";
            /** Available Sale Months */
            available_sale_months: string[];
            /**
             * Calendar Source Url
             * @default https://nube.agricultura.gob.mx/calendario_agricola/
             */
            calendar_source_url: string;
            /** Rows */
            rows: components["schemas"]["CycleCrop"][];
            /** Natural Best Crop Id */
            natural_best_crop_id: string | null;
            /** Margin Best Crop Id */
            margin_best_crop_id: string | null;
            /** Recommended Crop Id */
            recommended_crop_id: string | null;
            /** Recommendation Reason */
            recommendation_reason: string;
            /** Method Note */
            method_note: string;
            /**
             * Soil Source Url
             * @default https://www.nrcs.usda.gov/conservation-basics/soil/soil-health/soil-health-on-cropland
             */
            soil_source_url: string;
            /** Forecasts */
            forecasts: components["schemas"]["PriceForecast"][];
        };
        /** CyclePlanRequest */
        CyclePlanRequest: {
            /** Context Version */
            context_version: number;
            /** Sale Month */
            sale_month?: string | null;
            /**
             * Price Mode
             * @default forecast
             * @enum {string}
             */
            price_mode: "forecast" | "mexican_observation";
            /** Assumptions */
            assumptions?: components["schemas"]["CycleAssumption-Input"][];
        };
        /** DemoP1 */
        DemoP1: {
            probe: components["schemas"]["SimulatedProbe"];
            window: components["schemas"]["Period"];
            spot: components["schemas"]["CommercialResult"];
            cooperative: components["schemas"]["CommercialResult"];
        };
        /** DimensionScore */
        DimensionScore: {
            /** Dimension */
            dimension: string;
            /** Score */
            score: number;
            /** Weight */
            weight: number;
            /** Contribution */
            contribution: number;
            /** Reasons */
            reasons: {
                [key: string]: unknown;
            }[];
        } & {
            [key: string]: unknown;
        };
        /** DraftWrite */
        DraftWrite: {
            /** Expected Plan Version */
            expected_plan_version: number;
            plan: components["schemas"]["SowingPlanInput-Input"];
        };
        /** EquipmentConstraint */
        EquipmentConstraint: {
            /** Id */
            id: string;
            /** Confirmed */
            confirmed: boolean;
            /** Note */
            note: string;
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            kind: "equipment_available";
            /** Equipment Ids */
            equipment_ids: string[];
        };
        /** EvaluationInput */
        EvaluationInput: {
            request: components["schemas"]["EvaluationRequest-Input"];
            /** Weekly Cells */
            weekly_cells: components["schemas"]["WeeklyCell"][];
        };
        /** EvaluationRequest */
        "EvaluationRequest-Input": {
            /**
             * Contract Version
             * @default 0.2.0
             * @enum {string}
             */
            contract_version: "0.1.0" | "0.2.0";
            /** Parcel Id */
            parcel_id: string;
            /** Context Version */
            context_version: number;
            /** Horizon Cycles */
            horizon_cycles: number;
            priorities: components["schemas"]["Priorities"];
            /** Candidates */
            candidates: components["schemas"]["Candidate"][];
            /** Constraints */
            constraints: (components["schemas"]["WaterConstraint"] | components["schemas"]["EquipmentConstraint"] | components["schemas"]["MarketConstraint"] | components["schemas"]["TransitionConstraint"])[];
            /** Scenario */
            scenario?: {
                [key: string]: unknown;
            } | null;
            /** Commercial Scenarios */
            commercial_scenarios?: components["schemas"]["CommercialScenario-Input"][];
        };
        /** EvaluationRequest */
        "EvaluationRequest-Output": {
            /**
             * Contract Version
             * @default 0.2.0
             * @enum {string}
             */
            contract_version: "0.1.0" | "0.2.0";
            /** Parcel Id */
            parcel_id: string;
            /** Context Version */
            context_version: number;
            /** Horizon Cycles */
            horizon_cycles: number;
            priorities: components["schemas"]["Priorities"];
            /** Candidates */
            candidates: components["schemas"]["Candidate"][];
            /** Constraints */
            constraints: (components["schemas"]["WaterConstraint"] | components["schemas"]["EquipmentConstraint"] | components["schemas"]["MarketConstraint"] | components["schemas"]["TransitionConstraint"])[];
            /** Scenario */
            scenario?: {
                [key: string]: unknown;
            } | null;
            /** Commercial Scenarios */
            commercial_scenarios?: components["schemas"]["CommercialScenario-Output"][];
        };
        /** EvaluationResponse */
        EvaluationResponse: {
            /**
             * Contract Version
             * @default 0.2.0
             * @enum {string}
             */
            contract_version: "0.1.0" | "0.2.0";
            /** Id */
            id: string;
            /** Parcel Id */
            parcel_id: string;
            /** Context Version */
            context_version: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Engine Version */
            engine_version: string;
            /** Rules Version */
            rules_version: string;
            /** Catalog Version */
            catalog_version: string;
            /**
             * Data Kind
             * @enum {string}
             */
            data_kind: "observed" | "derived" | "synthetic";
            /** Horizon Cycles */
            horizon_cycles: number;
            request_snapshot: components["schemas"]["EvaluationRequest-Output"];
            /**
             * Status
             * @enum {string}
             */
            status: "computed" | "no_viable_options" | "needs_confirmation" | "illustrative";
            /** Recommendations */
            recommendations: components["schemas"]["RankedRotation"][];
            /** Excluded */
            excluded: components["schemas"]["ExcludedRotation"][];
            /** Warnings */
            warnings: string[];
            /** Commercial Results */
            commercial_results?: components["schemas"]["CommercialResult"][];
        } & {
            [key: string]: unknown;
        };
        /** EvidenceRef */
        EvidenceRef: {
            /**
             * Kind
             * @enum {string}
             */
            kind: "observation" | "feature" | "field_observation" | "knowledge" | "rule";
            /** Id */
            id: string;
        };
        /** ExcludedRotation */
        ExcludedRotation: {
            /** Candidate Id */
            candidate_id: string;
            /** Checks */
            checks: components["schemas"]["ConstraintCheck"][];
            /** Primary Constraint Id */
            primary_constraint_id?: string | null;
        } & {
            [key: string]: unknown;
        };
        /** ExplanationRequest */
        ExplanationRequest: {
            /** Context Version */
            context_version: number;
            /** Candidate Id */
            candidate_id: string;
            /** Scenario Id */
            scenario_id?: string | null;
            /** Question Es */
            question_es: string;
        };
        /** ExplanationResponse */
        ExplanationResponse: {
            /** Context Version */
            context_version: number;
            /**
             * Mode
             * @enum {string}
             */
            mode: "llm" | "deterministic";
            /** Text Es */
            text_es: string;
            primary_check?: components["schemas"]["ConstraintCheck"] | null;
        };
        /** Feature */
        Feature: {
            /** Id */
            id: string;
            /** Parcel Id */
            parcel_id: string;
            /** Name */
            name: string;
            /** Value */
            value: number | null;
            /** Unit */
            unit: string;
            /**
             * Status
             * @enum {string}
             */
            status: "available" | "missing";
            /** Missing Reason */
            missing_reason: string | null;
            period: components["schemas"]["Period"];
            /** Evidence */
            evidence: components["schemas"]["EvidenceRef"][];
            confidence: components["schemas"]["Confidence"];
            /**
             * Data Kind
             * @enum {string}
             */
            data_kind: "observed" | "derived" | "synthetic";
        } & {
            [key: string]: unknown;
        };
        /** FieldObservation */
        FieldObservation: {
            /** Id */
            id: string;
            /** Parcel Id */
            parcel_id: string;
            /** Variable */
            variable: string;
            /** Value */
            value: boolean | number | string;
            /** Unit */
            unit: string;
            /**
             * Observed At
             * Format: date-time
             */
            observed_at: string;
            /**
             * Recorded At
             * Format: date-time
             */
            recorded_at: string;
            /** Author Id */
            author_id: string;
            /** Confirmed */
            confirmed: boolean;
            /**
             * Data Kind
             * @enum {string}
             */
            data_kind: "observed" | "synthetic";
            /** Supersedes Id */
            supersedes_id?: string | null;
            /** Note */
            note: string;
            rain_gauge?: components["schemas"]["RainGaugeMeasurement"] | null;
            kobo?: components["schemas"]["KoboReceipt"] | null;
        } & {
            [key: string]: unknown;
        };
        /** FieldObservationRequest */
        FieldObservationRequest: {
            /**
             * Contract Version
             * @default 0.2.0
             * @enum {string}
             */
            contract_version: "0.1.0" | "0.2.0";
            /** Expected Context Version */
            expected_context_version: number;
            observation: components["schemas"]["RainGaugeInput"];
        };
        /** ForecastValidation */
        ForecastValidation: {
            /**
             * Method
             * @enum {string}
             */
            method: "last_price" | "seasonal_naive";
            /**
             * Method Version
             * @default producer-price-rolling-1
             * @constant
             */
            method_version: "producer-price-rolling-1";
            /** Mae */
            mae: string;
            /** Last Price Mae */
            last_price_mae: string;
            /** Seasonal Naive Mae */
            seasonal_naive_mae: string | null;
            /** Observations */
            observations: number;
            /** Horizon Start */
            horizon_start: number;
            /** Horizon End */
            horizon_end: number;
            /**
             * Scenario Error Percentile
             * @default 80
             * @constant
             */
            scenario_error_percentile: 80;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** KoboReceipt */
        KoboReceipt: {
            /**
             * Instance Id
             * Format: uuid
             */
            instance_id: string;
            /**
             * Form Id
             * @constant
             */
            form_id: "don-tino-rain";
            /** Form Version */
            form_version: string;
            /** Payload Sha256 */
            payload_sha256: string;
            /** Context Version */
            context_version: number;
        };
        /** KoboStatus */
        KoboStatus: {
            /** Enabled */
            enabled: boolean;
            /**
             * Form Id
             * @default don-tino-rain
             * @constant
             */
            form_id: "don-tino-rain";
            /**
             * Form Version
             * @default 2026111401
             */
            form_version: string;
        };
        /** LocalParcelCreate */
        LocalParcelCreate: {
            /** Name */
            name: string;
            /** Declared Area Ha */
            declared_area_ha: number | string;
            /** Municipality */
            municipality?: string | null;
            /** State */
            state?: string | null;
            /**
             * Production System
             * @default rainfed
             * @enum {string}
             */
            production_system: "rainfed" | "irrigated";
        };
        /** LocalParcelSummary */
        LocalParcelSummary: {
            /** Parcel Id */
            parcel_id: string;
            /** Name */
            name: string;
            /** Declared Area Ha */
            declared_area_ha: string;
            /** Municipality */
            municipality: string;
            /** State */
            state: string;
        };
        /** LocalRotationRefresh */
        LocalRotationRefresh: {
            /** Expected Context Version */
            expected_context_version: number;
        };
        /** MarketConstraint */
        MarketConstraint: {
            /** Id */
            id: string;
            /** Confirmed */
            confirmed: boolean;
            /** Note */
            note: string;
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            kind: "market_available";
            /** Crop Ids */
            crop_ids: string[];
            /** Buyer Refusals */
            buyer_refusals?: components["schemas"]["BuyerRefusal"][];
        };
        /** MarketQuote */
        MarketQuote: {
            /** Id */
            id: string;
            /**
             * Series Id
             * @enum {string}
             */
            series_id: "campeche-monthly" | "merida-weekly" | "merida-recent";
            /** Market Id */
            market_id: string;
            /** Market */
            market: string;
            /**
             * Granularity
             * @enum {string}
             */
            granularity: "monthly" | "daily";
            /**
             * Period Start
             * Format: date
             */
            period_start: string;
            /**
             * Period End
             * Format: date
             */
            period_end: string;
            /** Variety */
            variety: string;
            /** Quality */
            quality: string;
            /** Presentation */
            presentation: string | null;
            /** Origin */
            origin: string | null;
            /**
             * Original Unit
             * @constant
             */
            original_unit: "MXN/kg";
            /** Original Price */
            original_price: string;
            /**
             * Price Kind
             * @enum {string}
             */
            price_kind: "monthly_mean_frequent" | "daily_frequent";
            /** Mxn Kg */
            mxn_kg: string;
            /** Mxn Kg Min */
            mxn_kg_min: string | null;
            /** Mxn Kg Max */
            mxn_kg_max: string | null;
            /**
             * Retrieved At
             * Format: date-time
             */
            retrieved_at: string;
            /** Url Fuente */
            url_fuente: string;
            /** Missing Reason */
            missing_reason: string | null;
        };
        /** MarketReferenceResponse */
        MarketReferenceResponse: {
            /**
             * Contract Version
             * @default 0.2.0
             * @constant
             */
            contract_version: "0.2.0";
            /**
             * Series Id
             * @enum {string}
             */
            series_id: "campeche-monthly" | "merida-weekly" | "merida-recent";
            /** Market Id */
            market_id: string;
            /** Market */
            market: string;
            /**
             * Granularity
             * @enum {string}
             */
            granularity: "monthly" | "daily";
            period: components["schemas"]["Period"];
            /** Variety */
            variety: string;
            /** Quality */
            quality: string;
            /**
             * Source Name
             * @default SNIIM
             * @constant
             */
            source_name: "SNIIM";
            /**
             * Price Scope
             * @default wholesale
             * @constant
             */
            price_scope: "wholesale";
            /** Selected Month */
            selected_month: number;
            /** Rows */
            rows: components["schemas"]["MarketQuote"][];
            seasonal: components["schemas"]["MarketSummary"];
            weekly: components["schemas"]["MarketSummary"];
            delivery: components["schemas"]["ReferenceDelivery"];
        };
        /** MarketSummary */
        MarketSummary: {
            /**
             * Status
             * @enum {string}
             */
            status: "available" | "missing";
            /** N */
            n: number;
            /** Minimum Mxn Kg */
            minimum_mxn_kg: string | null;
            /** Median Mxn Kg */
            median_mxn_kg: string | null;
            /** Maximum Mxn Kg */
            maximum_mxn_kg: string | null;
            /** Missing Reason */
            missing_reason: string | null;
        };
        /** MonthlyForecast */
        MonthlyForecast: {
            /**
             * Month
             * Format: date
             */
            month: string;
            /** Low */
            low: string;
            /** Central */
            central: string;
            /** High */
            high: string;
        };
        /** MonthlyProducerPrice */
        MonthlyProducerPrice: {
            /**
             * Month
             * Format: date
             */
            month: string;
            /** Price */
            price: string;
            /** Source Flag */
            source_flag?: string | null;
            /** Source Url */
            source_url?: string | null;
            /** Source Note */
            source_note?: string | null;
        };
        /** MunicipalYieldRecord */
        MunicipalYieldRecord: {
            /** Year */
            year: number;
            /** Crop Id */
            crop_id: string;
            /** Crop Label */
            crop_label: string;
            /** Crop Code */
            crop_code: string;
            /**
             * Cycle
             * @enum {string}
             */
            cycle: "spring_summer" | "fall_winter";
            /**
             * Modality
             * @constant
             */
            modality: "rainfed";
            /** Harvested Area Ha */
            harvested_area_ha: string;
            /** Production T */
            production_t: string;
            /** Yield T Ha */
            yield_t_ha: string;
            /** Source Url */
            source_url: string;
            /** Source Sha256 */
            source_sha256: string;
            /**
             * Retrieved At
             * Format: date-time
             */
            retrieved_at: string;
            /** Source Rows */
            source_rows: number;
            /** Source Cader Codes */
            source_cader_codes: string[];
            /** Source Csv Lines */
            source_csv_lines: number[];
        };
        /** MunicipalYieldReference */
        MunicipalYieldReference: {
            /** Reference Id */
            reference_id: string;
            /** Crop Label */
            crop_label: string;
            /**
             * Cycle
             * @enum {string}
             */
            cycle: "spring_summer" | "fall_winter";
            /** Municipality */
            municipality: string;
            /** State */
            state: string;
            /**
             * Modality
             * @default rainfed
             * @constant
             */
            modality: "rainfed";
            /** Period Start Year */
            period_start_year: number;
            /** Period End Year */
            period_end_year: number;
            /** N */
            n: number;
            /** Median T Ha */
            median_t_ha: string;
            /** Min T Ha */
            min_t_ha: string;
            /** Max T Ha */
            max_t_ha: string;
            max_record: components["schemas"]["MunicipalYieldRecord"];
            /** Rows */
            rows: components["schemas"]["MunicipalYieldRecord"][];
            /**
             * Evidence Tier
             * @default derived
             * @constant
             */
            evidence_tier: "derived";
        };
        /** Observation */
        Observation: {
            /** Id */
            id: string;
            /** Parcel Id */
            parcel_id: string;
            /** Variable */
            variable: string;
            /** Value */
            value: number | null;
            /** Unit */
            unit: string;
            /**
             * Status
             * @enum {string}
             */
            status: "available" | "missing";
            /** Missing Reason */
            missing_reason: string | null;
            period: components["schemas"]["Period"];
            source: components["schemas"]["Source"];
            /**
             * Data Kind
             * @enum {string}
             */
            data_kind: "observed" | "derived" | "synthetic";
            /**
             * Spatial Support
             * @enum {string}
             */
            spatial_support: "regional" | "parcel_aggregate" | "pixel" | "field";
            /** Aggregation */
            aggregation: string;
            confidence: components["schemas"]["Confidence"];
        } & {
            [key: string]: unknown;
        };
        /** Parcel */
        Parcel: {
            /** Id */
            id: string;
            /** Municipality */
            municipality: string;
            /** State */
            state: string;
            /** Declared Area Ha */
            declared_area_ha: number;
            /** Geometry */
            geometry: {
                [key: string]: unknown;
            };
            /**
             * Geometry Kind
             * @enum {string}
             */
            geometry_kind: "provided" | "synthetic" | "unavailable";
            /**
             * Production System
             * @enum {string}
             */
            production_system: "rainfed" | "irrigated";
        } & {
            [key: string]: unknown;
        };
        /** ParcelAreaUpdate */
        ParcelAreaUpdate: {
            /** Expected Context Version */
            expected_context_version: number;
            /** Declared Area Ha */
            declared_area_ha: number | string;
        };
        /** ParcelContext */
        ParcelContext: {
            /**
             * Contract Version
             * @default 0.2.0
             * @enum {string}
             */
            contract_version: "0.1.0" | "0.2.0";
            /** Id */
            id: string;
            /** Context Version */
            context_version: number;
            /** Cycle Id */
            cycle_id: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /**
             * Data Kind
             * @enum {string}
             */
            data_kind: "observed" | "derived" | "synthetic";
            producer: components["schemas"]["Producer"];
            parcel: components["schemas"]["Parcel"];
            /** History */
            history: components["schemas"]["CropCycle"][];
            priorities: components["schemas"]["Priorities"];
            /** Constraints */
            constraints: (components["schemas"]["WaterConstraint"] | components["schemas"]["EquipmentConstraint"] | components["schemas"]["MarketConstraint"] | components["schemas"]["TransitionConstraint"])[];
            /** Soil */
            soil: {
                [key: string]: unknown;
            }[];
            /** Observations */
            observations: components["schemas"]["Observation"][];
            /** Features */
            features: components["schemas"]["Feature"][];
            /** Field Observations */
            field_observations: components["schemas"]["FieldObservation"][];
            /** Decisions */
            decisions: {
                [key: string]: unknown;
            }[];
            evaluation: components["schemas"]["EvaluationResponse"] | null;
            /** Pending Questions */
            pending_questions: string[];
            /** Warnings */
            warnings: string[];
            evidence_blocks?: components["schemas"]["ParcelEvidence"] | null;
            /** Confirmed Purchase Capacities */
            confirmed_purchase_capacities?: components["schemas"]["ConfirmedCapacity"][];
            /** Cooperative Capacity History */
            cooperative_capacity_history?: components["schemas"]["CooperativeCapacityHistoryEntry"][];
            /** Registered Area History */
            registered_area_history?: components["schemas"]["RegisteredAreaChange"][];
            /** Crop Cycle History */
            crop_cycle_history?: components["schemas"]["CropCycleChange"][];
            /** Weekly Cells */
            weekly_cells?: components["schemas"]["WeeklyCell"][];
            /** Evaluation State */
            evaluation_state?: ("vigente" | "pendiente_de_recalculo") | null;
            /** Recalculation Reason */
            recalculation_reason?: string | null;
            prior_commercial?: components["schemas"]["PriorCommercialRef"] | null;
            /** Last Evaluation Version */
            last_evaluation_version?: number | null;
            rain_comparison?: components["schemas"]["RainComparison"] | null;
        } & {
            [key: string]: unknown;
        };
        /** ParcelEvidence */
        ParcelEvidence: {
            agronomico: components["schemas"]["BlockEvidence"];
            comercial: components["schemas"]["BlockEvidence"];
            observacion_local: components["schemas"]["BlockEvidence"];
            secuencia_cultivos: components["schemas"]["BlockEvidence"];
        };
        /** Period */
        Period: {
            /**
             * Start
             * Format: date
             */
            start: string;
            /**
             * End
             * Format: date
             */
            end: string;
        };
        /** PlanShare */
        PlanShare: {
            /** Expected Plan Version */
            expected_plan_version: number;
        };
        /** PriceForecast */
        PriceForecast: {
            series: components["schemas"]["ProducerPriceSeries"];
            /**
             * As Of
             * Format: date
             */
            as_of: string;
            /**
             * Status
             * @enum {string}
             */
            status: "available" | "missing";
            /** Missing Reason */
            missing_reason?: string | null;
            /** Latest Observed Month */
            latest_observed_month?: string | null;
            /** Points */
            points?: components["schemas"]["MonthlyForecast"][];
            annual?: components["schemas"]["AnnualPriceForecast"] | null;
            validation?: components["schemas"]["ForecastValidation"] | null;
        };
        /**
         * PriceVolumeAssumption
         * @description Precio marginal para los kilos vendidos que exceden el umbral.
         */
        "PriceVolumeAssumption-Input": {
            /** Umbral Kg */
            umbral_kg: number;
            /** Precio Excedente Mxn Kg */
            precio_excedente_mxn_kg: number | string;
            /**
             * Evidence Tier
             * @default simulated_assumption
             * @constant
             */
            evidence_tier: "simulated_assumption";
        };
        /**
         * PriceVolumeAssumption
         * @description Precio marginal para los kilos vendidos que exceden el umbral.
         */
        "PriceVolumeAssumption-Output": {
            /** Umbral Kg */
            umbral_kg: number;
            /** Precio Excedente Mxn Kg */
            precio_excedente_mxn_kg: string;
            /**
             * Evidence Tier
             * @default simulated_assumption
             * @constant
             */
            evidence_tier: "simulated_assumption";
        };
        /** PriorCommercialRef */
        PriorCommercialRef: {
            /** Context Version */
            context_version: number;
            /** Evaluation Id */
            evaluation_id: string;
            /** Scenario Ids */
            scenario_ids: string[];
        };
        /** Priorities */
        Priorities: {
            /** Nitrogen */
            nitrogen: number;
            /** Erosion Cover */
            erosion_cover: number;
            /** Organic Matter */
            organic_matter: number;
            /** Pest Break */
            pest_break: number;
            /** Water Fit */
            water_fit: number;
            /** Forage */
            forage: number;
            /** Market */
            market: number;
        };
        /** Producer */
        Producer: {
            /** Id */
            id: string;
            /** Display Name */
            display_name: string;
            /**
             * Persona Kind
             * @enum {string}
             */
            persona_kind: "composite_demo" | "real";
        } & {
            [key: string]: unknown;
        };
        /** ProducerPriceSeries */
        ProducerPriceSeries: {
            /** Series Id */
            series_id: string;
            /** Crop Id */
            crop_id: string;
            /** Product */
            product: string;
            /** Geography */
            geography: string;
            /** Geography Code */
            geography_code?: string | null;
            /** State Code */
            state_code?: string | null;
            /** Municipality Code */
            municipality_code?: string | null;
            /**
             * Geography Level
             * @default national
             * @enum {string}
             */
            geography_level: "national" | "region" | "state" | "municipality";
            /**
             * Observation Kind
             * @default monthly
             * @enum {string}
             */
            observation_kind: "monthly" | "point_in_month";
            /** Currency */
            currency: string;
            /** Unit */
            unit: string;
            /** Source Name */
            source_name: string;
            /** Source Url */
            source_url: string;
            /** Download Url */
            download_url?: string | null;
            /** Retrieved At */
            retrieved_at?: string | null;
            /**
             * Price Scope
             * @default producer
             * @constant
             */
            price_scope: "producer";
            /** Variety Match */
            variety_match?: ("exact" | "aggregate") | null;
            /** Rows */
            rows: components["schemas"]["MonthlyProducerPrice"][];
        };
        /** PublishedSalePlan */
        PublishedSalePlan: {
            /** Plan Version */
            plan_version: number;
            /** Context Version */
            context_version: number;
            /** Campaign Year */
            campaign_year: number;
            /**
             * Shared At
             * Format: date-time
             */
            shared_at: string;
        };
        /** RainComparison */
        RainComparison: {
            /**
             * Status
             * @enum {string}
             */
            status: "available" | "missing";
            /** Missing Reason */
            missing_reason?: string | null;
            local: components["schemas"]["FieldObservation"] | null;
            power: components["schemas"]["Observation"] | null;
        };
        /** RainGaugeInput */
        RainGaugeInput: {
            /** Id */
            id: string;
            /** Parcel Id */
            parcel_id: string;
            /**
             * Variable
             * @constant
             */
            variable: "precipitation";
            /** Value */
            value: number;
            /**
             * Unit
             * @constant
             */
            unit: "mm";
            /**
             * Observed At
             * Format: date-time
             */
            observed_at: string;
            /** Author Id */
            author_id: string;
            /** Confirmed */
            confirmed: boolean;
            /**
             * Data Kind
             * @enum {string}
             */
            data_kind: "observed" | "synthetic";
            /** Supersedes Id */
            supersedes_id?: string | null;
            /** Note */
            note: string;
            rain_gauge: components["schemas"]["RainGaugeMeasurement"];
        };
        /** RainGaugeMeasurement */
        RainGaugeMeasurement: {
            /**
             * Method
             * @constant
             */
            method: "rain_gauge";
            /**
             * Accumulation Start
             * Format: date-time
             */
            accumulation_start: string;
            /**
             * Accumulation End
             * Format: date-time
             */
            accumulation_end: string;
            source: components["schemas"]["Source"];
        };
        /** RankedRotation */
        RankedRotation: {
            candidate: components["schemas"]["Candidate"];
            /** Rank */
            rank: number;
            /** Total Score */
            total_score: number;
            /** Dimensions */
            dimensions: components["schemas"]["DimensionScore"][];
            /** Constraint Checks */
            constraint_checks: components["schemas"]["ConstraintCheck"][];
            confidence: components["schemas"]["Confidence"];
        } & {
            [key: string]: unknown;
        };
        /** ReferenceDelivery */
        ReferenceDelivery: {
            /**
             * Mode
             * @enum {string}
             */
            mode: "live" | "cache" | "snapshot";
            /**
             * Attempted At
             * Format: date-time
             */
            attempted_at: string;
            /** Fallback Reason */
            fallback_reason?: string | null;
        };
        /** RegisteredAreaChange */
        RegisteredAreaChange: {
            /** Context Version */
            context_version: number;
            /** Previous Area Ha */
            previous_area_ha: string;
            /** Declared Area Ha */
            declared_area_ha: string;
            /**
             * Recorded At
             * Format: date-time
             */
            recorded_at: string;
        };
        /** RotationStep */
        RotationStep: {
            /** Cycle Offset */
            cycle_offset: number;
            /** Crop Ids */
            crop_ids: string[];
            /**
             * Arrangement
             * @enum {string}
             */
            arrangement: "single_crop" | "intercrop";
        };
        /** SaleComparison */
        SaleComparison: {
            /** Estimated Margin Mxn */
            estimated_margin_mxn?: string | null;
            /** Estimated Sold Kg */
            estimated_sold_kg?: string | null;
            /** Actual Sold Kg */
            actual_sold_kg?: string | null;
            /** Actual Revenue Mxn */
            actual_revenue_mxn?: string | null;
            /** Actual Cost Mxn */
            actual_cost_mxn?: string | null;
            /** Actual Margin Mxn */
            actual_margin_mxn?: string | null;
            /** Margin Difference Mxn */
            margin_difference_mxn?: string | null;
            /**
             * Sale Count
             * @default 0
             */
            sale_count: number;
        };
        /** SimulatedProbe */
        SimulatedProbe: {
            /**
             * Evidence Tier
             * @default simulated_assumption
             * @constant
             */
            evidence_tier: "simulated_assumption";
            /**
             * N Observaciones
             * @default 1
             * @constant
             */
            n_observaciones: 1;
            /** Sensor Reference */
            sensor_reference: string;
            /**
             * Variable
             * @default volumetric_water_content
             * @constant
             */
            variable: "volumetric_water_content";
            /** Value */
            value: string;
            /**
             * Unit
             * @default m³/m³
             * @constant
             */
            unit: "m³/m³";
            /** Depth Cm */
            depth_cm: number;
            /**
             * Simulated Date
             * Format: date
             */
            simulated_date: string;
            /** Calibration */
            calibration: string;
            /** Manufacturer Url */
            manufacturer_url: string;
        };
        /** Source */
        Source: {
            /** Id */
            id: string;
            /** Name */
            name: string;
            /** Kind */
            kind: string;
            /**
             * Retrieved At
             * Format: date-time
             */
            retrieved_at: string;
            /** Url */
            url?: string | null;
        } & {
            [key: string]: unknown;
        };
        /** SowingAppliedCapacity */
        SowingAppliedCapacity: {
            /** Value */
            value: string;
            /**
             * Basis
             * @enum {string}
             */
            basis: "assumption" | "reported" | "cooperative_confirmation";
            /** Source */
            source?: string | null;
        };
        /** SowingCropEconomics */
        SowingCropEconomics: {
            /**
             * Crop Id
             * @enum {string}
             */
            crop_id: "calabaza" | "frijol" | "maiz" | "saladette";
            cost_per_ha: components["schemas"]["SowingEconomicsInputValue-Output"];
            sale_capacity_kg: components["schemas"]["SowingAppliedCapacity"];
            capacity_confirmation?: components["schemas"]["ConfirmedCapacity"] | null;
            /** Loss Fraction */
            loss_fraction: string;
            loss_input?: components["schemas"]["SowingEconomicsInputValue-Output"] | null;
            /** Price Mxn Kg */
            price_mxn_kg: string;
            /**
             * Price Basis
             * @enum {string}
             */
            price_basis: "local_forecast" | "mexican_observation" | "international_index" | "local_assumption";
            price_input?: components["schemas"]["SowingEconomicsInputValue-Output"] | null;
            /** Reference Geography */
            reference_geography?: string | null;
            /** Reference Product */
            reference_product?: string | null;
            /** Reference Observed Month */
            reference_observed_month?: string | null;
            /** Reference Observed Url */
            reference_observed_url?: string | null;
        };
        /** SowingCropEconomicsDefaults */
        SowingCropEconomicsDefaults: {
            /**
             * Crop Id
             * @enum {string}
             */
            crop_id: "calabaza" | "frijol" | "maiz" | "saladette";
            cost_per_ha: components["schemas"]["SowingEconomicsInputValue-Output"];
            sale_capacity_kg: components["schemas"]["SowingEconomicsInputValue-Output"];
        };
        /** SowingCropEconomicsInput */
        "SowingCropEconomicsInput-Input": {
            /**
             * Crop Id
             * @enum {string}
             */
            crop_id: "calabaza" | "frijol" | "maiz" | "saladette";
            cost_per_ha?: components["schemas"]["SowingEconomicsInputValue-Input"] | null;
            sale_capacity_kg?: components["schemas"]["SowingEconomicsInputValue-Input"] | null;
            yield_t_ha?: components["schemas"]["SowingEconomicsInputValue-Input"] | null;
            price_mxn_kg?: components["schemas"]["SowingEconomicsInputValue-Input"] | null;
            loss_fraction?: components["schemas"]["SowingEconomicsInputValue-Input"] | null;
        };
        /** SowingCropEconomicsInput */
        "SowingCropEconomicsInput-Output": {
            /**
             * Crop Id
             * @enum {string}
             */
            crop_id: "calabaza" | "frijol" | "maiz" | "saladette";
            cost_per_ha?: components["schemas"]["SowingEconomicsInputValue-Output"] | null;
            sale_capacity_kg?: components["schemas"]["SowingEconomicsInputValue-Output"] | null;
            yield_t_ha?: components["schemas"]["SowingEconomicsInputValue-Output"] | null;
            price_mxn_kg?: components["schemas"]["SowingEconomicsInputValue-Output"] | null;
            loss_fraction?: components["schemas"]["SowingEconomicsInputValue-Output"] | null;
        };
        /** SowingCropMissingInputs */
        SowingCropMissingInputs: {
            /**
             * Crop Id
             * @enum {string}
             */
            crop_id: "calabaza" | "frijol" | "maiz" | "saladette";
            /** Fields */
            fields: ("yield_t_ha" | "price_mxn_kg" | "loss_fraction" | "cost_per_ha" | "sale_capacity_kg")[];
        };
        /** SowingCropOption */
        SowingCropOption: {
            /**
             * Crop Id
             * @enum {string}
             */
            crop_id: "calabaza" | "frijol" | "maiz" | "saladette";
            /** Label */
            label: string;
            /** Yield T Ha */
            yield_t_ha: string | null;
            /**
             * Yield Basis
             * @enum {string}
             */
            yield_basis: "municipal_median" | "demo_assumption" | "user_assumption" | "reported" | "missing";
            /** Yield Reference Url */
            yield_reference_url: string | null;
        };
        /** SowingEconomicsInputValue */
        "SowingEconomicsInputValue-Input": {
            /** Value */
            value: number | string;
            /**
             * Basis
             * @enum {string}
             */
            basis: "assumption" | "reported";
            /** Source */
            source?: string | null;
        };
        /** SowingEconomicsInputValue */
        "SowingEconomicsInputValue-Output": {
            /** Value */
            value: string;
            /**
             * Basis
             * @enum {string}
             */
            basis: "assumption" | "reported";
            /** Source */
            source?: string | null;
        };
        /** SowingMetrics */
        SowingMetrics: {
            /** Parcel Id */
            parcel_id: string;
            /** Producer Name */
            producer_name: string;
            /** Municipality */
            municipality: string;
            /** State */
            state: string;
            /** Current Context Version */
            current_context_version: number;
            shared_plan: components["schemas"]["SowingPlanSnapshot"] | null;
        };
        /** SowingPlanEconomics */
        SowingPlanEconomics: {
            /**
             * Sale Month
             * Format: date
             */
            sale_month: string;
            /** Estimated Margin Mxn */
            estimated_margin_mxn: string | null;
            /** Crops */
            crops: components["schemas"]["SowingCropEconomics"][];
            /** Missing Inputs */
            missing_inputs?: components["schemas"]["SowingCropMissingInputs"][];
        };
        /** SowingPlanInput */
        "SowingPlanInput-Input": {
            /** Context Version */
            context_version: number;
            /** Area Ha */
            area_ha: number | string;
            /** Zones */
            zones: components["schemas"]["SowingZoneInput-Input"][];
            /** Crop Economics */
            crop_economics?: components["schemas"]["SowingCropEconomicsInput-Input"][];
        };
        /** SowingPlanInput */
        "SowingPlanInput-Output": {
            /** Context Version */
            context_version: number;
            /** Area Ha */
            area_ha: string;
            /** Zones */
            zones: components["schemas"]["SowingZoneInput-Output"][];
            /** Crop Economics */
            crop_economics?: components["schemas"]["SowingCropEconomicsInput-Output"][];
        };
        /** SowingPlanResult */
        SowingPlanResult: {
            /** Context Version */
            context_version: number;
            /**
             * Agricultural Cycle
             * @default spring_summer
             * @constant
             */
            agricultural_cycle: "spring_summer";
            /** Campaign Year */
            campaign_year: number;
            /** Area Ha */
            area_ha: string;
            /** Assigned Area Ha */
            assigned_area_ha: string;
            /** Unassigned Area Ha */
            unassigned_area_ha: string;
            /** Estimated Harvest Kg */
            estimated_harvest_kg: string | null;
            /** Zones */
            zones: components["schemas"]["SowingZoneResult"][];
            /** Crop Economics */
            crop_economics?: components["schemas"]["SowingCropEconomicsInput-Output"][];
            economics?: components["schemas"]["SowingPlanEconomics"] | null;
        };
        /** SowingPlanSnapshot */
        SowingPlanSnapshot: {
            /** Plan Version */
            plan_version: number;
            /**
             * Saved At
             * Format: date-time
             */
            saved_at: string;
            /** Shared At */
            shared_at: string | null;
            plan: components["schemas"]["SowingPlanResult"];
        };
        /** SowingPlanState */
        SowingPlanState: {
            /** Context Version */
            context_version: number;
            /** Declared Area Ha */
            declared_area_ha: string;
            /**
             * Sale Month
             * Format: date
             */
            sale_month: string;
            /** Crop Options */
            crop_options: components["schemas"]["SowingCropOption"][];
            /** Default Crop Economics */
            default_crop_economics: components["schemas"]["SowingCropEconomicsDefaults"][];
            /** Cooperative Capacities */
            cooperative_capacities?: components["schemas"]["ConfirmedCapacity"][];
            default_input: components["schemas"]["SowingPlanInput-Output"];
            draft: components["schemas"]["SowingPlanSnapshot"] | null;
            /** Shared Version */
            shared_version: number | null;
        };
        /** SowingSalesReport */
        SowingSalesReport: {
            /** Plans */
            plans: components["schemas"]["PublishedSalePlan"][];
            /** Plan Version */
            plan_version: number | null;
            /** Sales */
            sales: components["schemas"]["ZoneSale"][];
            /** Zones */
            zones: components["schemas"]["ZoneSaleComparison"][];
            totals: components["schemas"]["SaleComparison"];
            /** History */
            history?: components["schemas"]["ZoneSaleChange"][];
        };
        /** SowingZoneEconomics */
        SowingZoneEconomics: {
            /** Marketable Kg */
            marketable_kg: string;
            /** Sold Kg */
            sold_kg: string;
            /** Revenue Mxn */
            revenue_mxn: string;
            /** Cost Mxn */
            cost_mxn: string;
            /** Margin Mxn */
            margin_mxn: string;
        };
        /** SowingZoneInput */
        "SowingZoneInput-Input": {
            /** Zone Id */
            zone_id: string;
            /**
             * Crop Id
             * @enum {string}
             */
            crop_id: "calabaza" | "frijol" | "maiz" | "saladette";
            /** Area Ha */
            area_ha: number | string;
        };
        /** SowingZoneInput */
        "SowingZoneInput-Output": {
            /** Zone Id */
            zone_id: string;
            /**
             * Crop Id
             * @enum {string}
             */
            crop_id: "calabaza" | "frijol" | "maiz" | "saladette";
            /** Area Ha */
            area_ha: string;
        };
        /** SowingZoneResult */
        SowingZoneResult: {
            /** Zone Id */
            zone_id: string;
            /**
             * Crop Id
             * @enum {string}
             */
            crop_id: "calabaza" | "frijol" | "maiz" | "saladette";
            /** Area Ha */
            area_ha: string;
            /** Crop Label */
            crop_label: string;
            /** Estimated Harvest Kg */
            estimated_harvest_kg: string | null;
            /** Yield T Ha */
            yield_t_ha: string | null;
            /**
             * Yield Basis
             * @enum {string}
             */
            yield_basis: "municipal_median" | "demo_assumption" | "user_assumption" | "reported" | "missing";
            /** Yield Reference Url */
            yield_reference_url: string | null;
            yield_input?: components["schemas"]["SowingEconomicsInputValue-Output"] | null;
            economics?: components["schemas"]["SowingZoneEconomics"] | null;
        };
        /** StationReading */
        StationReading: {
            /** Sensor Id */
            sensor_id: number;
            /**
             * Observed At
             * Format: date-time
             */
            observed_at: string;
            /** Temperature C */
            temperature_c: number | null;
            /** Humidity Pct */
            humidity_pct: number | null;
            /** Rain Today Mm */
            rain_today_mm: number | null;
        };
        /** TransitionConstraint */
        TransitionConstraint: {
            /** Id */
            id: string;
            /** Confirmed */
            confirmed: boolean;
            /** Note */
            note: string;
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            kind: "crop_transition";
            /** Crop Id */
            crop_id: string;
            /** Required Previous Crop Id */
            required_previous_crop_id: string;
        };
        /** UsdaCampaign */
        UsdaCampaign: {
            /** Market Year */
            market_year: number;
            /** Value */
            value: string;
            /** Revision Year */
            revision_year: number;
            /** Revision Month */
            revision_month: number;
        };
        /** UsdaData */
        UsdaData: {
            /**
             * Source Name
             * @default USDA FAS · PSD Online
             * @constant
             */
            source_name: "USDA FAS · PSD Online";
            /**
             * Source Url
             * @default https://fas.usda.gov/psdonline
             * @constant
             */
            source_url: "https://fas.usda.gov/psdonline";
            /**
             * Download Url
             * @default https://apps.fas.usda.gov/psdonline/downloads/psd_grains_pulses_csv.zip
             * @constant
             */
            download_url: "https://apps.fas.usda.gov/psdonline/downloads/psd_grains_pulses_csv.zip";
            /**
             * Retrieved At
             * Format: date-time
             */
            retrieved_at: string;
            /** Published At */
            published_at: string | null;
            /**
             * Geography
             * @default México · nacional
             * @constant
             */
            geography: "México · nacional";
            /**
             * Country Code
             * @default MX
             * @constant
             */
            country_code: "MX";
            /**
             * Commodity
             * @default Maíz
             * @constant
             */
            commodity: "Maíz";
            /**
             * Indicator
             * @default Producción nacional
             * @constant
             */
            indicator: "Producción nacional";
            /**
             * Unit
             * @default miles de toneladas métricas
             * @constant
             */
            unit: "miles de toneladas métricas";
            /** Rows */
            rows: components["schemas"]["UsdaCampaign"][];
            /**
             * Scope Note
             * @default Cada campaña comercial de maíz en México comienza en octubre y termina en septiembre. Las cifras de USDA son estimaciones nacionales sujetas a revisión. Se muestran como contexto, fuera del cálculo de precios, rendimientos y márgenes de Don Tino.
             * @constant
             */
            scope_note: "Cada campaña comercial de maíz en México comienza en octubre y termina en septiembre. Las cifras de USDA son estimaciones nacionales sujetas a revisión. Se muestran como contexto, fuera del cálculo de precios, rendimientos y márgenes de Don Tino.";
            /** Archive Sha256 */
            archive_sha256: string;
        };
        /** UsdaReferenceResponse */
        UsdaReferenceResponse: {
            data: components["schemas"]["UsdaData"];
            delivery: components["schemas"]["ReferenceDelivery"];
        };
        /** ValidationError */
        ValidationError: {
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
            /** Input */
            input?: unknown;
            /** Context */
            ctx?: Record<string, never>;
        };
        /** WaterConstraint */
        WaterConstraint: {
            /** Id */
            id: string;
            /** Confirmed */
            confirmed: boolean;
            /** Note */
            note: string;
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            kind: "water_budget";
            /** Available Mm */
            available_mm: number;
            period: components["schemas"]["Period"];
        };
        /** WeatherLinkResponse */
        WeatherLinkResponse: {
            /**
             * Status
             * @enum {string}
             */
            status: "available" | "unconfigured" | "unavailable";
            /** Origin */
            origin?: ("station" | "documentation") | null;
            /** Delivery */
            delivery?: ("live" | "cache") | null;
            /** Checked At */
            checked_at?: string | null;
            /** Message */
            message?: string | null;
            /**
             * Source Url
             * @default https://weatherlink.github.io/v2-api/api-response
             */
            source_url: string;
            /** Station Label */
            station_label?: string | null;
            /** Readings */
            readings?: components["schemas"]["StationReading"][];
        };
        /** WeeklyCell */
        WeeklyCell: {
            /** Parcel Id */
            parcel_id: string;
            week: components["schemas"]["Period"];
            /** Observations */
            observations: components["schemas"]["Observation"][];
            /** Coverage Fraction */
            coverage_fraction: number;
            /** Warnings */
            warnings: string[];
        };
        /** YieldAssumption */
        YieldAssumption: {
            /**
             * Kind
             * @enum {string}
             */
            kind: "manual" | "municipal_median";
            /** Reference Id */
            reference_id?: string | null;
        };
        /** YieldReferenceResponse */
        YieldReferenceResponse: {
            /** Crop Id */
            crop_id: string;
            /**
             * Cycle
             * @enum {string}
             */
            cycle: "spring_summer" | "fall_winter";
            /**
             * Municipality
             * @default Hopelchén
             * @constant
             */
            municipality: "Hopelchén";
            /**
             * State
             * @default Campeche
             * @constant
             */
            state: "Campeche";
            /**
             * Modality
             * @default rainfed
             * @constant
             */
            modality: "rainfed";
            /**
             * Source Url
             * @default https://nube.agricultura.gob.mx/datosAbiertos/Agricola.php
             */
            source_url: string;
            /**
             * Status
             * @enum {string}
             */
            status: "available" | "missing";
            /** Missing Reason */
            missing_reason?: string | null;
            reference?: components["schemas"]["MunicipalYieldReference"] | null;
        };
        /** ZoneSale */
        ZoneSale: {
            /** Zone Id */
            zone_id: string;
            /**
             * Sold On
             * Format: date
             */
            sold_on: string;
            /** Sold Kg */
            sold_kg: string;
            /** Price Mxn Kg */
            price_mxn_kg: string;
            /** Cost Mxn */
            cost_mxn: string;
            /** Reference */
            reference?: string | null;
            /**
             * Sale Id
             * Format: uuid
             */
            sale_id: string;
            /** Plan Version */
            plan_version: number;
            /**
             * Revision
             * @default 1
             */
            revision: number;
            /**
             * Recorded At
             * Format: date-time
             */
            recorded_at: string;
            /** Revenue Mxn */
            revenue_mxn: string;
            /** Margin Mxn */
            margin_mxn: string;
        };
        /** ZoneSaleChange */
        ZoneSaleChange: {
            /**
             * Change Id
             * Format: uuid
             */
            change_id: string;
            /**
             * Action
             * @enum {string}
             */
            action: "corrected" | "voided";
            previous: components["schemas"]["ZoneSale"];
            replacement: components["schemas"]["ZoneSale"] | null;
            /**
             * Recorded At
             * Format: date-time
             */
            recorded_at: string;
            /** Reason */
            reason?: string | null;
        };
        /** ZoneSaleComparison */
        ZoneSaleComparison: {
            /** Estimated Margin Mxn */
            estimated_margin_mxn?: string | null;
            /** Estimated Sold Kg */
            estimated_sold_kg?: string | null;
            /** Actual Sold Kg */
            actual_sold_kg?: string | null;
            /** Actual Revenue Mxn */
            actual_revenue_mxn?: string | null;
            /** Actual Cost Mxn */
            actual_cost_mxn?: string | null;
            /** Actual Margin Mxn */
            actual_margin_mxn?: string | null;
            /** Margin Difference Mxn */
            margin_difference_mxn?: string | null;
            /**
             * Sale Count
             * @default 0
             */
            sale_count: number;
            /** Zone Id */
            zone_id: string;
            /** Crop Label */
            crop_label: string;
        };
        /** ZoneSaleCorrection */
        ZoneSaleCorrection: {
            /**
             * Change Id
             * Format: uuid
             */
            change_id: string;
            /** Expected Revision */
            expected_revision: number;
            /** Reason */
            reason?: string | null;
            /** Zone Id */
            zone_id: string;
            /**
             * Sold On
             * Format: date
             */
            sold_on: string;
            /** Sold Kg */
            sold_kg: number | string;
            /** Price Mxn Kg */
            price_mxn_kg: number | string;
            /** Cost Mxn */
            cost_mxn: number | string;
            /** Reference */
            reference?: string | null;
        };
        /** ZoneSaleRegistration */
        ZoneSaleRegistration: {
            /** Zone Id */
            zone_id: string;
            /**
             * Sold On
             * Format: date
             */
            sold_on: string;
            /** Sold Kg */
            sold_kg: number | string;
            /** Price Mxn Kg */
            price_mxn_kg: number | string;
            /** Cost Mxn */
            cost_mxn: number | string;
            /** Reference */
            reference?: string | null;
            /**
             * Sale Id
             * Format: uuid
             */
            sale_id: string;
            /** Plan Version */
            plan_version: number;
        };
        /** ZoneSaleVoid */
        ZoneSaleVoid: {
            /**
             * Change Id
             * Format: uuid
             */
            change_id: string;
            /** Expected Revision */
            expected_revision: number;
            /** Reason */
            reason?: string | null;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    market_reference_v1_market_references__series_id__get: {
        parameters: {
            query?: {
                /** @description Mes para el resumen estacional. */
                month?: number;
                /** @description Volver a consultar SNIIM. */
                refresh?: boolean;
            };
            header?: never;
            path: {
                series_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MarketReferenceResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    usda_reference_v1_usda_references_mexico_corn_production_get: {
        parameters: {
            query?: {
                /** @description Volver a consultar USDA FAS. */
                refresh?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsdaReferenceResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    integration_status_integrations_kobo_status_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["KoboStatus"];
                };
            };
        };
    };
    kobo_form_list_integrations_kobo_formList_get: {
        parameters: {
            query?: {
                formID?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    kobo_form_xml_integrations_kobo_forms_don_tino_rain_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    kobo_submission_integrations_kobo_submission_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Multipart inválido */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Credenciales inválidas */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Parcela inexistente */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Versión desactualizada o envío modificado */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Envío demasiado grande */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Formulario o lectura inválidos */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Almacén no disponible */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    kobo_submission_check_integrations_kobo_submission_head: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    weatherlink_current_v1_weatherlink_current_get: {
        parameters: {
            query?: {
                example?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WeatherLinkResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_sowing_plan_v1_contexts__parcel_id__sowing_plan_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SowingPlanState"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    preview_sowing_plan_v1_contexts__parcel_id__sowing_plan_preview_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SowingPlanInput-Input"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SowingPlanResult"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    save_sowing_plan_v1_contexts__parcel_id__sowing_plan_draft_put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DraftWrite"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SowingPlanSnapshot"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    share_sowing_plan_v1_contexts__parcel_id__sowing_plan_share_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlanShare"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SowingPlanSnapshot"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    get_sowing_metrics_v1_contexts__parcel_id__sowing_metrics_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SowingMetrics"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    get_sowing_sales_v1_contexts__parcel_id__sowing_sales_get: {
        parameters: {
            query?: {
                plan_version?: number | null;
            };
            header?: never;
            path: {
                parcel_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SowingSalesReport"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    create_zone_sale_v1_contexts__parcel_id__sowing_sales_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ZoneSaleRegistration"];
            };
        };
        responses: {
            /** @description La venta ya estaba registrada. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SowingSalesReport"];
                };
            };
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SowingSalesReport"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    correct_zone_sale_v1_contexts__parcel_id__sowing_sales__sale_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
                sale_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ZoneSaleCorrection"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SowingSalesReport"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    void_zone_sale_v1_contexts__parcel_id__sowing_sales__sale_id__void_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
                sale_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ZoneSaleVoid"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SowingSalesReport"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    create_cooperative_capacity_v1_contexts__parcel_id__cooperative_capacities_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CooperativeCapacityRegistration"];
            };
        };
        responses: {
            /** @description El cupo ya estaba registrado. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParcelContext"];
                };
            };
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParcelContext"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    correct_cooperative_capacity_v1_contexts__parcel_id__cooperative_capacities__capacity_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
                capacity_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CooperativeCapacityCorrection"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParcelContext"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    cancel_cooperative_capacity_v1_contexts__parcel_id__cooperative_capacities__capacity_id__cancel_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
                capacity_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CooperativeCapacityCancellation"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParcelContext"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    put_registered_area_v1_contexts__parcel_id__registered_area_put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ParcelAreaUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParcelContext"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    list_local_parcels_v1_parcels_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalParcelSummary"][];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    create_local_parcel_v1_parcels_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LocalParcelCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParcelContext"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    post_crop_cycle_v1_contexts__parcel_id__crop_cycles_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CropCycleRegistration"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParcelContext"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    correct_crop_cycle_v1_contexts__parcel_id__crop_cycles__cycle_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
                cycle_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CropCycleCorrection"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParcelContext"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    void_crop_cycle_v1_contexts__parcel_id__crop_cycles__cycle_id__void_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
                cycle_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CropCycleVoid"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParcelContext"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    refresh_local_rotation_v1_contexts__parcel_id__crop_rotation_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LocalRotationRefresh"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParcelContext"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    municipal_yield_reference_v1_yield_references__crop_id__get: {
        parameters: {
            query: {
                cycle: "spring_summer" | "fall_winter";
            };
            header?: never;
            path: {
                crop_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["YieldReferenceResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    health_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    fixture_context_demo_don_tino_context_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParcelContext"];
                };
            };
        };
    };
    fixture_collection_demo_don_tino_collection_request_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollectionRequest"];
                };
            };
        };
    };
    power_snapshot_demo_don_tino_power_snapshot_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollectionResult"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    fixture_evaluation_demo_don_tino_evaluation_request_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvaluationRequest-Output"];
                };
            };
        };
    };
    demo_p1_demo_don_tino_p1_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DemoP1"];
                };
            };
        };
    };
    collect_v1_collections_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CollectionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollectionResult"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Bad Gateway */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Gateway Timeout */
            504: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    harmonize_v1_harmonizations_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CollectionResult"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WeeklyCell"][];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    features_v1_features_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WeeklyCell"][];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Feature"][];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    evaluate_v1_evaluations_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EvaluationInput"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvaluationResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Not Implemented */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    current_context_v1_contexts__parcel_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParcelContext"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    plan_cycle_v1_contexts__parcel_id__cycle_plan_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CyclePlanRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CyclePlan"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Not Implemented */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    historical_context_v1_contexts__parcel_id__versions__version__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
                version: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParcelContext"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    fixture_assistant_demo_don_tino_assistant_context_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssistantContext"];
                };
            };
        };
    };
    explanation_v1_contexts__parcel_id__explanations_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExplanationRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExplanationResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Not Implemented */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    create_context_v1_contexts__parcel_id__versions_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                parcel_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContextSaveRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParcelContext"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Not Implemented */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    local_observation_v1_field_observations_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FieldObservationRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParcelContext"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Unprocessable Content */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    decisions_v1_decisions_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Not Implemented */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
}
