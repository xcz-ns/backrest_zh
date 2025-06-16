import { Collapse, Divider, Spin, Typography } from "antd";
import React, { useEffect, useState } from "react";
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
        {/* 链接在新标签页打开 */}
        <p>
          <a href="https://github.com/garethgeorge/backrest"  target="_blank">
            在GitHub上查看Backrest的新版本
          </a>
        </p>
        <Divider orientation="left">概述</Divider>
        <ul>
          <li>
            仓库直接对应restic仓库，请先配置备份位置。
          </li>
          <li>
            计划用于配置备份目录和备份调度。多个计划可以备份到同一个restic仓库。
          </li>
          <li>
            请查看{" "}
            <a
              href="https://restic.readthedocs.io/en/latest/030_preparing_a_new_repo.html" 
              target="_blank"
            >
              restic官方文档关于仓库准备
            </a>{" "}
            了解支持的仓库类型及其配置方法。
          </li>
          <li>
            请查看{" "}
            <a href="https://garethgeorge.github.io/backrest"  target="_blank">
              Backrest维基文档
            </a>{" "}
            获取Backrest配置指南。
          </li>
        </ul>
        <Divider orientation="left">提示</Divider>
        <ul>
          <li>
            备份Backrest配置：您的Backrest配置包含所有仓库、计划和解密密码。配置完成后，请务必将配置文件（或至少密码副本）存储在安全位置（例如密码管理器中的安全笔记）。
          </li>
          <li>
            配置钩子：Backrest可以推送备份事件通知。强烈建议您配置错误通知钩子，以便在备份失败时（如存储或网络问题）及时收到通知。钩子可在计划或仓库层级配置。
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
                  label: "配置JSON因安全原因隐藏",
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