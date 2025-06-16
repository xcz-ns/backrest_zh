import { Collapse, Divider, Spin, Typography } from "antd";
import React from "react";
import { backrestService } from "../api";
import { useConfig } from "../components/ConfigProvider";
import { Config, ConfigSchema } from "../../gen/ts/v1/config_pb";
import { isDevBuild } from "../state/buildcfg";
import { toJsonString } from "@bufbuild/protobuf";

export const GettingStartedGuide = () => {
  const config = useConfig()[0];

  return (
    <>
      <Typography.Text>
        <h1>入门指南</h1>
        {/* 在新标签页中打开链接 */}
        <p>
          <a href="https://github.com/garethgeorge/backrest"  target="_blank" rel="noopener noreferrer">
            在 GitHub 上查看 Backrest 的最新版本
          </a>
        </p>
        <Divider orientation="left">概述</Divider>
        <ul>
          <li>
            存储库（Repo）直接对应 restic 的存储库，请先配置你的备份位置。
          </li>
          <li>
            计划（Plan）是你配置需要备份的目录和备份调度的地方。多个计划可以备份到同一个 restic 存储库。
          </li>
          <li>
            查看{" "}
            <a
              href="https://restic.readthedocs.io/en/latest/030_preparing_a_new_repo.html" 
              target="_blank"
              rel="noopener noreferrer"
            >
              restic 官方文档关于准备新仓库的内容
            </a>{" "}
            了解支持的仓库类型以及如何进行配置。
          </li>
          <li>
            查看{" "}
            <a
              href="https://garethgeorge.github.io/backrest" 
              target="_blank"
              rel="noopener noreferrer"
            >
              Backrest Wiki
            </a>{" "}
            获取配置 Backrest 的详细说明。
          </li>
        </ul>

        <Divider orientation="left">使用建议</Divider>
        <ul>
          <li>
            备份你的 Backrest 配置：Backrest 的配置文件包含你所有的仓库、计划以及解密它们所需的密码。
            当你完成 Backrest 的配置后，请务必保存一份配置的副本（或至少保存密码）在安全的位置，
            例如密码管理器中的安全笔记。
          </li>
          <li>
            配置钩子（Hook）：Backrest 可以在备份事件发生时发送通知。强烈建议你配置一个“出错时”通知钩子，
            以便在备份失败时（如存储或网络连接问题）能及时收到通知。钩子可以在计划或仓库级别进行配置。
          </li>
        </ul>

        {isDevBuild && (
          <>
            <Divider orientation="left">配置查看</Divider>
            <Collapse
              size="small"
              items={[
                {
                  key: "1",
                  label: "出于安全考虑，配置 JSON 被隐藏",
                  children: config ? (
                    <Typography>
                      <pre>
                        {toJsonString(ConfigSchema, config, {
                          prettySpaces: 2,
                        })}
                      </pre>
                    </Typography>
                  ) : (
                    <Spin />
                  ),
                },
              ]}
            />
          </>
        )}
      </Typography.Text>
    </>
  );
};