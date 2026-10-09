# Replicate Video Generation Pricing --- No Reference Video Input

**Last checked:** October 10, 2026\
**Currency:** USD\
**Scope:** Pricing per second of generated output when no reference
video is supplied. These are published model-page rates, not a guarantee
of the final invoice.

## Price comparison

  --------------------------------------------------------------------------------------
  Model                                        480p                 720p Other published
                                                                         resolution
                                                                         tiers
  ---------------------------- -------------------- -------------------- ---------------
  ByteDance Seedance 2.5               \$0.1028/sec         \$0.2312/sec Check the live
  (`bytedance/seedance-2.5`)                                             model page for
                                                                         additional
                                                                         tiers

  ByteDance Seedance 2.0                 \$0.08/sec           \$0.18/sec 1080p:
  (`bytedance/seedance-2.0`)                                             \$0.45/sec; 4K:
                                                                         \$1.00/sec

  MiniMax H3 (`minimax/h3`)             Not offered          Not offered 768P:
                                                                         \$0.08/sec; 2K:
                                                                         \$0.13/sec

  Alibaba Wan 3.0                        \$0.05/sec           \$0.10/sec 1080p:
  (`alibaba/wan-3`)                                                      \$0.20/sec
  --------------------------------------------------------------------------------------

## Example costs

  Model          Resolution     5-second output   10-second output
  -------------- ------------ ----------------- ------------------
  Seedance 2.5   480p                   \$0.514            \$1.028
  Seedance 2.5   720p                   \$1.156            \$2.312
  Seedance 2.0   480p                    \$0.40             \$0.80
  Seedance 2.0   720p                    \$0.90             \$1.80
  MiniMax H3     768P                    \$0.40             \$0.80
  MiniMax H3     2K                      \$0.65             \$1.30
  Wan 3.0        480p                    \$0.25             \$0.50
  Wan 3.0        720p                    \$0.50             \$1.00

## Official Replicate sources

-   Billing rules: https://replicate.com/docs/topics/billing
-   Seedance 2.5: https://replicate.com/bytedance/seedance-2.5
-   Seedance 2.0: https://replicate.com/bytedance/seedance-2.0
-   MiniMax H3: https://replicate.com/minimax/h3
-   Wan 3.0: https://replicate.com/alibaba/wan-3

## Notes

-   For Seedance 2.5 and Seedance 2.0, the rates above use the
    `non_video_in` variant, i.e. no reference video input.
-   MiniMax H3 supports 768P and 2K output, not 480p or 720p according
    to its Replicate model page.
-   Wan 3.0 supports text-to-video and optional first-frame
    image-to-video. No reference video is required for the listed rates.
-   Replicate says public models are billed for active processing time,
    and model-specific pricing is shown on each model page. Check the
    live pages before large production batches because prices can
    change.
-   These estimates are simply output duration multiplied by the
    published per-second rate. They exclude any separate services,
    taxes, or currency-conversion fees that may apply.
